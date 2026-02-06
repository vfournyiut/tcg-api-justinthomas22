import request from 'supertest'
import { describe, it, beforeEach, expect, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../src/index'
import { prismaMock } from './vitest.setup'

describe('Routes d\'authentification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/sign-up', () => {
    it('devrait renvoyer 400 si l\'email est manquant', async () => {
      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ username: 'test', password: 'pass123' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 400 si le nom d\'utilisateur est manquant', async () => {
      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ email: 'test@test.fr', password: 'pass123' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 400 si le mot de passe est manquant', async () => {
      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ email: 'test@test.fr', username: 'test' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 400 si toutes les données sont manquantes', async () => {
      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 409 si l\'email existe déjà', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'existing@test.fr',
        username: 'existing',
        password: 'hashedpass',
      } as any)

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ email: 'existing@test.fr', username: 'newuser', password: 'pass123' })

      expect(res.status).toBe(409)
      expect(res.body).toHaveProperty('error', 'Email déjà utilisé')
    })

    it('devrait créer l\'utilisateur et renvoyer le token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      ;(bcrypt.hash as any).mockResolvedValue('hashedpassword123')
      prismaMock.user.create.mockResolvedValue({
        id: 1,
        email: 'newuser@test.fr',
        username: 'newuser',
        password: 'hashedpassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      ;(jwt.sign as any).mockReturnValue('jwt_token_123')

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ email: 'newuser@test.fr', username: 'newuser', password: 'pass123' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('token', 'jwt_token_123')
      expect(res.body).toHaveProperty('user')
      expect(res.body.user).toHaveProperty('id', 1)
      expect(res.body.user).toHaveProperty('email', 'newuser@test.fr')
      expect(res.body.user).toHaveProperty('username', 'newuser')
    })

    it('devrait renvoyer 500 en cas d\'erreur serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ email: 'test@test.fr', username: 'test', password: 'pass123' })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error', 'Erreur serveur')
    })
  })

  describe('POST /api/auth/sign-in', () => {
    it('devrait renvoyer 400 si l\'email est manquant', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ password: 'pass123' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 400 si le mot de passe est manquant', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'test@test.fr' })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 400 si toutes les données sont manquantes', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error', 'Données manquantes')
    })

    it('devrait renvoyer 401 si l\'utilisateur n\'existe pas', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'nonexistent@test.fr', password: 'pass123' })

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('error', 'Email ou mot de passe incorrect')
    })

    it('devrait renvoyer 401 si le mot de passe est incorrect', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.fr',
        username: 'user',
        password: 'hashedpassword',
      } as any)
      ;(bcrypt.compare as any).mockResolvedValue(false)

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'user@test.fr', password: 'wrongpassword' })

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('error', 'Email ou mot de passe incorrect')
    })

    it('devrait renvoyer 200 et le token si les identifiants sont corrects', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 2,
        email: 'user@test.fr',
        username: 'user',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      ;(bcrypt.compare as any).mockResolvedValue(true)
      ;(jwt.sign as any).mockReturnValue('jwt_token_456')

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'user@test.fr', password: 'correctpassword' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token', 'jwt_token_456')
      expect(res.body).toHaveProperty('user')
      expect(res.body.user).toHaveProperty('id', 2)
      expect(res.body.user).toHaveProperty('email', 'user@test.fr')
    })

    it('devrait renvoyer 500 en cas d\'erreur serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'test@test.fr', password: 'pass123' })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error', 'Erreur serveur')
    })
  })

  describe('GET /api/health', () => {
    it('devrait renvoyer un statut ok', async () => {
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('status', 'ok')
      expect(res.body).toHaveProperty('message', 'TCG Backend Server is running')
    })
  })
})
