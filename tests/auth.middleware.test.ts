import { describe, it, expect, vi } from 'vitest'
import { Request, Response } from 'express'
import { authenticateToken } from '../src/auth/auth.middleware'
import jwt from 'jsonwebtoken'

describe('Middleware d\'authentification', () => {
  describe('Gestion du token manquant', () => {
    it('devrait retourner 401 si pas de header Authorization', () => {
      const mockReq: any = {
        headers: {},
        user: undefined,
      }
      const jsonSpy = vi.fn().mockReturnValue({ error: '' })
      const mockRes: any = {
        status: vi.fn().mockReturnValue({ json: jsonSpy }),
      }
      const mockNext = vi.fn()

      authenticateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Token manquant' })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Vérification JWT valide', () => {
    it('devrait appeler next() et définir req.user si token valide', () => {
      const validToken = 'valid.jwt.token'
      const decodedUser = { userId: 1, email: 'test@test.com' }
      
      const mockReq: any = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        user: undefined,
      }
      const mockNext = vi.fn()
      const jsonSpy = vi.fn().mockReturnValue({ error: '' })
      const mockRes: any = {
        status: vi.fn().mockReturnValue({ json: jsonSpy }),
      }
      
      vi.mocked(jwt.verify).mockReturnValue(decodedUser as any)

      authenticateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(jwt.verify).toHaveBeenCalledWith(validToken, process.env.JWT_SECRET)
      expect(mockReq.user).toEqual(decodedUser)
      expect(mockNext).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalled()
    })
  })

  describe('Gestion des erreurs JWT', () => {
    it('devrait retourner 401 si token invalide', () => {
      const invalidToken = 'invalid.token'
      
      const mockReq: any = {
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
        user: undefined,
      }
      const jsonSpy = vi.fn().mockReturnValue({ error: '' })
      const mockRes: any = {
        status: vi.fn().mockReturnValue({ json: jsonSpy }),
      }
      const mockNext = vi.fn()
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Token invalide')
      })

      authenticateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Token invalide ou expiré' })
      expect(mockNext).not.toHaveBeenCalled()
    })

  })
})
