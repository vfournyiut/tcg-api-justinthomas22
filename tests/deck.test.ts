import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { prismaMock } from './vitest.setup'
import { app } from '../src/index'
import type { DeckModel as Deck, CardModel as Card, DeckCardModel as DeckCard } from '../src/generated/prisma/models'
import { PokemonType } from '../src/generated/prisma/enums'

// Mock du middleware d'authentification
vi.mock('../src/auth/auth.middleware', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { userId: 1, email: 'test@test.com' }
    next()
  })
}))

const createMockCard = (id: number): Card => ({
  id,
  name: `Pokemon ${id}`,
  pokedexNumber: id,
  hp: 50 + id,
  attack: 40 + id,
  type: PokemonType.Normal,
  imgUrl: `https://example.com/pokemon/${id}.png`,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('POST /api/decks', () => {

  it('renvoie 400 si le nom est manquant', async () => {
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ cards: Array.from({ length: 10 }, (_, i) => i + 1) })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Nom manquant')
  })

  it('renvoie 400 si le tableau de cartes est invalide', async () => {
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Mon Deck', cards: [1, 2, 3] })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes')
  })

  it('renvoie 400 si les cartes n’existent pas', async () => {
    prismaMock.card.findMany.mockResolvedValue([] as Card[])

    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Mon Deck', cards: Array.from({ length: 10 }, (_, i) => i + 1000) })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Cartes invalides ou inexistantes')
  })

  it('crée un deck avec succès', async () => {
    const mockCards: Card[] = Array.from({ length: 10 }, (_, i) => createMockCard(i + 1))

    prismaMock.card.findMany.mockResolvedValue(mockCards)

    const mockDeck: Deck = {
      id: 1,
      name: 'Mon Deck',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    prismaMock.deck.create.mockResolvedValue(mockDeck)

    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Mon Deck', cards: Array.from({ length: 10 }, (_, i) => i + 1) })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id', 1)
    expect(res.body).toHaveProperty('name', 'Mon Deck')
    expect(res.body).toHaveProperty('userId', 1)
  })

  it('renvoie 500 en cas d’erreur serveur', async () => {
    prismaMock.card.findMany.mockRejectedValue(new Error('Erreur base de données'))

    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Mon Deck', cards: Array.from({ length: 10 }, (_, i) => i + 1) })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Erreur serveur')
  })
})

describe('GET /api/decks/mine', () => {
  it('devrait retourner la liste des decks de l\'utilisateur', async () => {
    const mockDeck: Deck = {
      id: 1,
      name: 'My Deck',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findMany.mockResolvedValue([mockDeck])
    const res = await request(app).get('/api/decks/mine').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].id).toBe(1)
  })
  it('renvoie 500 en cas d’erreur serveur', async () => {
    prismaMock.deck.findMany.mockRejectedValue(new Error('Erreur base de données'))
    const res = await request(app).get('/api/decks/mine').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

describe('GET /api/decks/:id', () => {

  it('renvoie 404 si le deck n’existe pas', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/decks/999').set('Authorization','Bearer token')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('renvoie 403 si l’utilisateur n’est pas propriétaire', async () => {
    const otherDeck: Deck = {
      id: 1,
      name: 'Autre Deck',
      userId: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(otherDeck)
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('renvoie le deck si l’utilisateur est propriétaire', async () => {
    const myDeck: Deck = {
      id: 1,
      name: 'Mon Deck',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(myDeck)
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name','Mon Deck')
  })

  it('renvoie 500 en cas d’erreur serveur', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Erreur base de données'))
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

describe('PATCH /api/decks/:id', () => {

  it('renvoie 404 si le deck n’existe pas', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).patch('/api/decks/999').set('Authorization','Bearer token').send({ name: 'Mis à jour' })
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('renvoie 403 si l’utilisateur n’est pas propriétaire', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({ id: 1, name: 'Autre Deck', userId: 2, createdAt: new Date(), updatedAt: new Date() })
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({ name: 'Mis à jour' })
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('met à jour uniquement le nom avec succès', async () => {
    const oldDeck: Deck = { 
      id: 1, 
      name: 'Ancien Deck', 
      userId: 1, 
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(oldDeck)
    // Copie les propriétés du deck initial et remplace le nom et la date
    prismaMock.deck.update.mockResolvedValue({ ...oldDeck, name: 'Mis à jour', updatedAt: new Date() })
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({ name: 'Mis à jour' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name','Mis à jour')
  })

  it('renvoie 400 si le tableau de cartes est invalide', async () => {
    const oldDeck: Deck = { 
      id: 1, 
      name: 'Ancien Deck', 
      userId: 1, 
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(oldDeck)
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({ cards: [1,2,3] })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error','Le deck doit contenir exactement 10 cartes')
  })

  it('renvoie 400 si les cartes n’existent pas', async () => {
    const oldDeck: Deck = { 
      id: 1, 
      name: 'Ancien Deck', 
      userId: 1, 
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(oldDeck)
    prismaMock.card.findMany.mockResolvedValue([] as Card[])
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token')
      // Génère un tableau de 10 IDs inexistants pour tester le rejet des cartes invalides
      .send({ cards: Array.from({ length: 10 }, (_, i) => i + 1000) })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error','Cartes invalides ou inexistantes')
  })

  it('met à jour les cartes avec succès', async () => {
    const oldDeck: Deck = { 
      id: 1, 
      name: 'Ancien Deck', 
      userId: 1, 
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const newCards = Array.from({ length: 10 }, (_, i) => i + 1)
    const validCards: Card[] = newCards.map(id => createMockCard(id))

    prismaMock.deck.findUnique.mockResolvedValue(oldDeck)
    prismaMock.card.findMany.mockResolvedValue(validCards)
    prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.deckCard.createMany.mockResolvedValue({ count: 10 })
    prismaMock.deck.update.mockResolvedValue({
      ...oldDeck,
    })

    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({ cards: newCards })
    expect(res.status).toBe(200)
  })

  it('renvoie 500 en cas d’erreur serveur', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Erreur base de données'))
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({ name: 'Mis à jour' })
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

describe('DELETE /api/decks/:id', () => {

  it('renvoie 404 si le deck n’existe pas', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).delete('/api/decks/999').set('Authorization','Bearer token')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('renvoie 403 si l’utilisateur n’est pas propriétaire', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({ id: 1, name: 'Autre Deck', userId: 2, createdAt: new Date(), updatedAt: new Date() })
    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('supprime le deck avec succès', async () => {
    const myDeck: Deck = { 
      id: 1, 
      name: 'Mon Deck', 
      userId: 1, 
      createdAt: new Date(),
      updatedAt: new Date()
    }
    prismaMock.deck.findUnique.mockResolvedValue(myDeck)
    prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 10 })
    prismaMock.deck.delete.mockResolvedValue(myDeck)

    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message','Deck supprimé avec succès')
  })

  it('renvoie 500 en cas d’erreur serveur', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Erreur base de données'))
    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})
