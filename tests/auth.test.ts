import request from 'supertest'
import { describe, it, expect, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../src/index'
import { prismaMock } from './vitest.setup'

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}))

describe("Routes d'authentification", () => {

  describe('POST /api/auth/sign-up', () => {
    it('renvoie 400 si les données sont manquantes ou invalides', async () => {
      const cases = [
        { username: 'test', password: 'pass123' },
        { email: 'test@test.fr', password: 'pass123' },
        { email: 'test@test.fr', username: 'test' },
        {}
      ]
      for (const body of cases) {
        const res = await request(app).post('/api/auth/sign-up').send(body)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error', 'Données manquantes')
      }
    })

    it('renvoie 409 si l’email existe déjà', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'existing@test.fr',

      })

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({
          email: 'existing@test.fr',
          username: 'newuser',
          password: 'pass123',
        })

      expect(res.status).toBe(409)
      expect(res.body).toHaveProperty('error', 'Email déjà utilisé')
    })

    it("crée un utilisateur et renvoie le token", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockImplementation(async () => 'hashedpassword123')
      prismaMock.user.create.mockResolvedValue({
        id: 1,
        email: 'newuser@test.fr',
        username: 'newuser',
      })
      vi.mocked(jwt.sign).mockImplementation(() => 'jwt_token_123')

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({
          email: 'newuser@test.fr',
          username: 'newuser',
          password: 'pass123',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('token', 'jwt_token_123')
      expect(res.body.user).toMatchObject({
        id: 1,
        email: 'newuser@test.fr',
        username: 'newuser',
      })
    })

    it('renvoie 500 en cas d’erreur serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({
          email: 'test@test.fr',
          username: 'test',
          password: 'pass123',
        })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error', 'Erreur serveur')
    })
  })

  describe('POST /api/auth/sign-in', () => {
    it('renvoie 400 si les données sont manquantes', async () => {
      const cases = [
        { password: 'pass123' },
        { email: 'test@test.fr' },
        {}
      ]
      for (const body of cases) {
        const res = await request(app).post('/api/auth/sign-in').send(body)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error', 'Données manquantes')
      }
    })

    it("renvoie 401 si l'utilisateur n'existe pas ou mot de passe incorrect", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      let res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'mail@test.fr', password: 'pass123' })
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('error', 'Email ou mot de passe incorrect')

      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.fr',
        username: 'user',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(bcrypt.compare).mockImplementation(async () => false)

      res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'user@test.fr', password: 'wrongpassword' })
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('error', 'Email ou mot de passe incorrect')
    })

    it('auth réussie renvoie 200 et token', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 2,
        email: 'user@test.fr',
        username: 'user',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(bcrypt.compare).mockImplementation(async () => true)
      vi.mocked(jwt.sign).mockImplementation(() => 'jwt_token_456')

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'user@test.fr', password: 'correctpassword' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token', 'jwt_token_456')
      expect(res.body.user).toMatchObject({
        id: 2,
        email: 'user@test.fr',
      })
    })

    it('renvoie 500 en cas d’erreur serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'test@test.fr', password: 'pass123' })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error', 'Erreur serveur')
    })
  })

  describe('GET /api/health', () => {
    it('renvoie un statut ok', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        status: 'ok',
        message: 'TCG Backend Server is running',
      })
    })
  })
})
