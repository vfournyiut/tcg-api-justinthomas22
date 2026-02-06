import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { prismaMock } from './vitest.setup'
import { app } from '../src/index'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/decks', () => {
  it('should return 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ cards: [1,2,3,4,5,6,7,8,9,10] })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Nom manquant')
  })

  it('should return 400 if cards array is invalid', async () => {
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'My Deck', cards: [1,2,3] })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Le deck doit contenir exactement 10 cartes')
  })

  it('should return 400 if cards do not exist', async () => {
    prismaMock.card.findMany.mockResolvedValue([])
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'My Deck', cards: [999,998,997,996,995,994,993,992,991,990] })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Cartes invalides ou inexistantes')
  })

  it('should create deck successfully', async () => {
    const mockCards = Array.from({length:10}, (_,i) => ({id:i+1,pokedexNumber:i+1,name:`Pokemon ${i+1}`}))

    prismaMock.card.findMany.mockResolvedValue(mockCards as any)
    prismaMock.deck.create.mockResolvedValue({
      id: 1,
      name: 'My Deck',
      userId: 1,
      deckCards: mockCards.map(c => ({id:c.id, deckId:1, cardId:c.id, card:c})),
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'My Deck', cards: [1,2,3,4,5,6,7,8,9,10] })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id', 1)
    expect(res.body).toHaveProperty('name', 'My Deck')
    expect(res.body).toHaveProperty('userId', 1)
  })

  it('should return 500 on server error', async () => {
    prismaMock.card.findMany.mockRejectedValue(new Error('Database error'))
    const res = await request(app)
      .post('/api/decks')
      .set('Authorization', 'Bearer token')
      .send({ name: 'My Deck', cards: [1,2,3,4,5,6,7,8,9,10] })

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error', 'Erreur serveur')
  })
})

describe('GET /api/decks/mine', () => {
  it('should return empty array if no decks', async () => {
    prismaMock.deck.findMany.mockResolvedValue([])
    const res = await request(app).get('/api/decks/mine').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('should return user decks', async () => {
    const mockDecks = [
      { id:1,name:'Deck 1',userId:1,deckCards:[{id:1,deckId:1,cardId:1,card:{id:1,name:'Pikachu'}}], createdAt:new Date(), updatedAt:new Date() },
      { id:2,name:'Deck 2',userId:1,deckCards:[{id:2,deckId:2,cardId:2,card:{id:2,name:'Raichu'}}], createdAt:new Date(), updatedAt:new Date() }
    ]
    prismaMock.deck.findMany.mockResolvedValue(mockDecks as any)
    const res = await request(app).get('/api/decks/mine').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toHaveProperty('name','Deck 1')
  })

  it('should return 500 on server error', async () => {
    prismaMock.deck.findMany.mockRejectedValue(new Error('Database error'))
    const res = await request(app).get('/api/decks/mine').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

describe('GET /api/decks/:id', () => {
  it('should return 404 if deck not found', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).get('/api/decks/999').set('Authorization','Bearer token')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('should return 403 if not owner', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({id:1,name:'Other Deck',userId:2,deckCards:[],createdAt:new Date(),updatedAt:new Date()} as any)
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('should return deck if owner', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({
      id:1,name:'My Deck',userId:1,deckCards:[{id:1,deckId:1,cardId:1,card:{id:1,name:'Pikachu'}}],createdAt:new Date(),updatedAt:new Date()
    } as any)
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name','My Deck')
  })

  it('should return 500 on server error', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Database error'))
    const res = await request(app).get('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

// ==================== PATCH /api/decks/:id ====================
describe('PATCH /api/decks/:id', () => {
  it('should return 404 if deck not found', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).patch('/api/decks/999').set('Authorization','Bearer token').send({name:'Updated'})
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('should return 403 if not owner', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({id:1,name:'Other Deck',userId:2,deckCards:[]} as any)
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({name:'Updated'})
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('should update name successfully', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({id:1,name:'Old Deck',userId:1,deckCards:[]} as any)
    prismaMock.deck.update.mockResolvedValue({id:1,name:'Updated',userId:1,deckCards:[],createdAt:new Date(),updatedAt:new Date()} as any)
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({name:'Updated'})
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name','Updated')
  })

  // ======= NOUVEAUX TESTS POUR LES CARTES INVALIDES =======
  it('should return 400 if cards array is invalid', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({ id:1, name:'Old Deck', userId:1, deckCards:[]} as any)

    const res = await request(app)
      .patch('/api/decks/1')
      .set('Authorization','Bearer token')
      .send({ cards: [1,2,3] }) // moins de 10 cartes

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error','Le deck doit contenir exactement 10 cartes')
  })

  it('should return 400 if cards do not exist', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({ id:1, name:'Old Deck', userId:1, deckCards:[]} as any)
    prismaMock.card.findMany.mockResolvedValue([]) // aucune carte trouvée

    const res = await request(app)
      .patch('/api/decks/1')
      .set('Authorization','Bearer token')
      .send({ cards: [999,998,997,996,995,994,993,992,991,990] }) // cartes invalides

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error','Cartes invalides ou inexistantes')
  })

  it('should update cards successfully', async () => {
    const oldDeck = { id: 1, name: 'Old Deck', userId: 1, deckCards: [{ id:1, deckId:1, cardId:1 }] }
    const newCards = Array.from({ length: 10 }, (_, i) => i + 1)
    const validCards = newCards.map(id => ({ id, pokedexNumber: id, name: `Pokemon ${id}` }))

    prismaMock.deck.findUnique.mockResolvedValue(oldDeck as any)
    prismaMock.card.findMany.mockResolvedValue(validCards as any)
    prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.deckCard.createMany.mockResolvedValue({ count: 10 })
    prismaMock.deck.update.mockResolvedValue({
      ...oldDeck,
      deckCards: validCards.map(c => ({ id: c.id, deckId: 1, cardId: c.id, card: c })),
      name: oldDeck.name
    } as any)

    const res = await request(app)
      .patch('/api/decks/1')
      .set('Authorization', 'Bearer token')
      .send({ cards: newCards })

    expect(res.status).toBe(200)
    expect(res.body.deckCards).toHaveLength(10)
  })

  it('should return 500 on server error', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Database error'))
    const res = await request(app).patch('/api/decks/1').set('Authorization','Bearer token').send({name:'Updated'})
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})

describe('DELETE /api/decks/:id', () => {
  it('should return 404 if deck not found', async () => {
    prismaMock.deck.findUnique.mockResolvedValue(null)
    const res = await request(app).delete('/api/decks/999').set('Authorization','Bearer token')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error','Deck inexistant')
  })

  it('should return 403 if not owner', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({id:1,name:'Other Deck',userId:2} as any)
    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(403)
    expect(res.body).toHaveProperty('error','Accès refusé')
  })

  it('should delete deck successfully', async () => {
    prismaMock.deck.findUnique.mockResolvedValue({id:1,name:'My Deck',userId:1} as any)
    prismaMock.deckCard.deleteMany.mockResolvedValue({count:10})
    prismaMock.deck.delete.mockResolvedValue({id:1,name:'My Deck',userId:1} as any)
    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message','Deck supprimé avec succès')
  })

  it('should return 500 on server error', async () => {
    prismaMock.deck.findUnique.mockRejectedValue(new Error('Database error'))
    const res = await request(app).delete('/api/decks/1').set('Authorization','Bearer token')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error','Erreur serveur')
  })
})
