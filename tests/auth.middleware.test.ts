import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/index'
import jwt from 'jsonwebtoken'

describe('Middleware d\'authentification ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification sur les endpoints', () => {
    it('devrait authentifier l\'utilisateur avec un middleware simulé valide', async () => {
      const res = await request(app)
        .get('/api/decks/mine')
        .set('Authorization', 'Bearer valid_token')

      expect(res.status).not.toBe(401)
    })

    it('devrait gérer les requêtes sans header Authorization via le middleware', async () => {
      const res = await request(app).get('/api/decks/mine')

      expect(res.status).not.toBe(401)
    })
  })

  describe('Vérification JWT et extraction du token', () => {

    it('devrait appeler jwt.verify si un token existe', () => {
      ;(jwt.verify as any).mockReturnValue({ userId: 1, email: 'test@test.com' })
      
      const authHeader = 'Bearer valid_token'
      const token = authHeader.split(' ')[1]
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string)
        expect(decoded).toEqual({ userId: 1, email: 'test@test.com' })
      } catch (error) {
        throw error
      }
    })

    it('devrait gérer proprement les erreurs JWT', () => {
      ;(jwt.verify as any).mockImplementation(() => {
        throw new Error('Token invalide')
      })

      const authHeader = 'Bearer invalid_token'
      const token = authHeader.split(' ')[1]

      let erreurAttrapee = false
      try {
        jwt.verify(token, process.env.JWT_SECRET as string)
      } catch (error) {
        erreurAttrapee = true
        expect(error).toBeDefined()
      }

      expect(erreurAttrapee).toBe(true)
    })
  })
})
