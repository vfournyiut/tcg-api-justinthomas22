import type { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { shuffle } from 'lodash'
import { Server, Socket } from 'socket.io'
import { env } from '../env'
import { prisma } from '../database'

interface UserData {
  userId: number
  email: string
}

interface Card {
  id: number
  name: string
  hp: number
  attack: number
  type: string
  imgUrl: string | null
}

interface Player {
  socketId: string
  userId: number
  username: string
  deckId: number
  hand: Card[]
}

interface Room {
  id: string
  host: Player
  guest: Player | null
  status: 'waiting' | 'playing'
  createdAt: Date
}

// Stockage des rooms en mémoire
const rooms: Map<string, Room> = new Map()
let roomIdCounter = 1

function generateRoomId(): string {
  return String(roomIdCounter++)
}

function getAvailableRooms() {
  return Array.from(rooms.values())
    .filter((room) => room.status === 'waiting')
    .map((room) => ({
      id: room.id,
      host: { userId: room.host.userId, username: room.host.username },
      createdAt: room.createdAt,
    }))
}

async function validateDeck(deckId: number, userId: number): Promise<{ valid: boolean; error?: string; cards?: Card[] }> {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { deckCards: { include: { card: true } } }
  })

  if (!deck) {
    return { valid: false, error: 'Deck non trouvé' }
  }
  if (deck.userId !== userId) {
    return { valid: false, error: 'Ce deck ne vous appartient pas' }
  }
  if (deck.deckCards.length !== 10) {
    return { valid: false, error: 'Le deck doit contenir exactement 10 cartes' }
  }

  const cards: Card[] = deck.deckCards.map((dc) => ({
    id: dc.card.id,
    name: dc.card.name,
    hp: dc.card.hp,
    attack: dc.card.attack,
    type: dc.card.type,
    imgUrl: dc.card.imgUrl,
  }))

  return { valid: true, cards }
}

// Génère l'état du jeu personnalisé pour un joueur (cache la main adverse)
function getGameState(room: Room, odId: number) {
  const isHost = room.host.userId === odId
  const me = isHost ? room.host : room.guest!
  const opponent = isHost ? room.guest! : room.host

  return {
    roomId: room.id,
    me: {
      username: me.username,
      hand: me.hand,
    },
    opponent: {
      username: opponent.username,
      handCount: opponent.hand.length, // On ne montre que le nombre, pas les cartes
    },
  }
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error('Token manquant'))
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as UserData
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })
      
      if (!user) {
        return next(new Error('Utilisateur non trouvé'))
      }
      
      socket.data.userId = decoded.userId
      socket.data.email = decoded.email
      socket.data.username = user.username
      next()
    } catch {
      next(new Error('Token invalide ou expiré'))
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log(`Joueur connecté: ${socket.data.username} (ID: ${socket.data.userId})`)

    socket.on('getRooms', () => {
      socket.emit('roomsList', getAvailableRooms())
    })

    socket.on('createRoom', async (data: { deckId: number | string }) => {
      try {
        const deckId = Number(data.deckId)
        const userId = socket.data.userId
        const username = socket.data.username

        if (!data.deckId || isNaN(deckId)) {
          socket.emit('error', { message: 'deckId requis et doit être un nombre' })
          return
        }

        const validation = await validateDeck(deckId, userId)
        if (!validation.valid) {
          socket.emit('error', { message: validation.error })
          return
        }

        const roomId = generateRoomId()
        const cards = shuffle(validation.cards!)
        
        const newRoom: Room = {
          id: roomId,
          host: {
            socketId: socket.id,
            userId,
            username,
            deckId,
            hand: cards.slice(0, 5),
          },
          guest: null,
          status: 'waiting',
          createdAt: new Date(),
        }

        rooms.set(roomId, newRoom)
        socket.join(roomId) // Rejoint la room Socket.io pour recevoir les events

        socket.emit('roomCreated', { roomId, message: 'Room créée avec succès' })
        io.emit('roomsListUpdated', getAvailableRooms()) // Notifie tous les clients

        console.log(`Room ${roomId} créée par ${username}`)
      } catch (error) {
        console.error('Erreur createRoom:', error)
        socket.emit('error', { message: 'Erreur lors de la création de la room' })
      }
    })

    socket.on('joinRoom', async (data: { roomId: string | number; deckId: string | number }) => {
      try {
        const roomId = String(data.roomId)
        const deckId = Number(data.deckId)
        const userId = socket.data.userId
        const username = socket.data.username

        if (!data.roomId || !data.deckId || isNaN(deckId)) {
          socket.emit('error', { message: 'roomId et deckId requis' })
          return
        }

        const room = rooms.get(roomId)
        if (!room) {
          socket.emit('error', { message: 'Room non trouvée' })
          return
        }

        if (room.status !== 'waiting') {
          socket.emit('error', { message: 'Cette room est déjà complète' })
          return
        }

        if (room.host.userId === userId) {
          socket.emit('error', { message: 'Vous ne pouvez pas rejoindre votre propre room' })
          return
        }

        const validation = await validateDeck(deckId, userId)
        if (!validation.valid) {
          socket.emit('error', { message: validation.error })
          return
        }

        const cards = shuffle(validation.cards!)
        room.guest = {
          socketId: socket.id,
          userId,
          username,
          deckId,
          hand: cards.slice(0, 5),
        }

        room.status = 'playing'
        socket.join(roomId)

        // Envoie l'état initial à chaque joueur avec sa vue personnalisée
        const hostSocket = io.sockets.sockets.get(room.host.socketId)
        if (hostSocket) {
          hostSocket.emit('gameStarted', getGameState(room, room.host.userId))
        }
        socket.emit('gameStarted', getGameState(room, room.guest.userId))

        io.emit('roomsListUpdated', getAvailableRooms())

        console.log(`Partie démarrée: ${room.host.username} vs ${username}`)
      } catch (error) {
        console.error('Erreur joinRoom:', error)
        socket.emit('error', { message: 'Erreur lors de la jonction à la room' })
      }
    })

    socket.on('disconnect', () => {
      console.log(`Joueur déconnecté: ${socket.data.username}`)
      
      // Supprime les rooms en attente si le host se déconnecte
      rooms.forEach((room, roomId) => {
        if (room.host.socketId === socket.id && room.status === 'waiting') {
          rooms.delete(roomId)
          io.emit('roomsListUpdated', getAvailableRooms())
        }
      })
    })
  })

  return io
}
