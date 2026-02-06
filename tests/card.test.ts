import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app } from '../src/index'
import { prismaMock } from './vitest.setup'

describe('Routes des cartes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/cards', () => {
    it('devrait renvoyer un tableau de cartes', async () => {
      const mockCards = [
        {
          id: 1,
          name: 'Pikachu',
          hp: 35,
          attack: 55,
          type: 'Electric',
          pokedexNumber: 25,
          imgUrl: 'https://example.com/pikachu.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Raichu',
          hp: 60,
          attack: 90,
          type: 'Electric',
          pokedexNumber: 26,
          imgUrl: 'https://example.com/raichu.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          name: 'Bulbasaur',
          hp: 45,
          attack: 49,
          type: 'Grass',
          pokedexNumber: 1,
          imgUrl: 'https://example.com/bulbasaur.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prismaMock.card.findMany.mockResolvedValue(mockCards as any)

      const res = await request(app).get('/api/cards')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[0]).toHaveProperty('name', 'Pikachu')
      expect(res.body[0]).toHaveProperty('hp', 35)
      expect(res.body[0]).toHaveProperty('attack', 55)
      expect(res.body[0]).toHaveProperty('type', 'Electric')
      expect(res.body[0]).toHaveProperty('pokedexNumber', 25)
    })

    it('devrait renvoyer les cartes triées par numéro dans le Pokédex croissant', async () => {
      const mockCards = [
        {
          id: 1,
          name: 'Bulbasaur',
          hp: 45,
          attack: 49,
          type: 'Grass',
          pokedexNumber: 1,
          imgUrl: 'https://example.com/bulbasaur.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Ivysaur',
          hp: 60,
          attack: 62,
          type: 'Grass',
          pokedexNumber: 2,
          imgUrl: 'https://example.com/ivysaur.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          name: 'Venusaur',
          hp: 80,
          attack: 82,
          type: 'Grass',
          pokedexNumber: 3,
          imgUrl: 'https://example.com/venusaur.png',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prismaMock.card.findMany.mockResolvedValue(mockCards as any)

      const res = await request(app).get('/api/cards')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[0].pokedexNumber).toBe(1)
      expect(res.body[1].pokedexNumber).toBe(2)
      expect(res.body[2].pokedexNumber).toBe(3)
    })

    it('devrait renvoyer 500 en cas d’erreur serveur', async () => {
      prismaMock.card.findMany.mockRejectedValue(new Error('Database error'))

      const res = await request(app).get('/api/cards')

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error', 'Erreur serveur')
    })
  })
})
