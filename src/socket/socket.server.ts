import type { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { shuffle } from 'lodash'
import { Server, Socket } from 'socket.io'
import { env } from '../env'
import { prisma } from '../database'
import { calculateDamage } from '../utils/rules.util'
import { PokemonType } from '../generated/prisma/client'

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
  deck: Card[] // Cartes restantes dans le deck
  hand: Card[] 
  activeCard: Card | null  // Carte sur le terrain
  score: number // 3 pts pour gagner
}

interface Room {
  id: string
  host: Player
  guest: Player | null
  status: 'waiting' | 'playing'
  createdAt: Date
  currentPlayerSocketId: string | null  // Tour du joueur actuel
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

function getGameState(room: Room, odId: number) {
  const isHost = room.host.userId === odId
  const me = isHost ? room.host : room.guest!
  const opponent = isHost ? room.guest! : room.host

  return {
    roomId: room.id,
    currentPlayerSocketId: room.currentPlayerSocketId,
    me: {
      username: me.username,
      hand: me.hand,
      activeCard: me.activeCard,
      score: me.score,
    },
    opponent: {
      username: opponent.username,
      handCount: opponent.hand.length, 
      activeCard: opponent.activeCard,
      score: opponent.score,
    },
  }
}

// Vérifie si c'est le tour du joueur
function isPlayerTurn(room: Room, socketId: string): boolean {
  return room.currentPlayerSocketId === socketId
}

// Trouve la room d'un joueur et retourne aussi son rôle
function findPlayerRoom(socketId: string): { room: Room; isHost: boolean } | null {
  for (const room of rooms.values()) {
    if (room.host.socketId === socketId) {
      return { room, isHost: true }
    }
    if (room.guest && room.guest.socketId === socketId) {
      return { room, isHost: false }
    }
  }
  return null
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
            deck: cards.slice(5),     // Les 5 cartes restantes dans le deck
            hand: cards.slice(0, 5), 
            activeCard: null,
            score: 0,
          },
          guest: null,
          status: 'waiting',
          createdAt: new Date(),
          currentPlayerSocketId: null,
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
          deck: cards.slice(5),     // Les 5 cartes restantes dans le deck
          hand: cards.slice(0, 5),  // Les 5 premières cartes en main
          activeCard: null,
          score: 0,
        }

        room.status = 'playing'
        // Le créateur de la room commence
        room.currentPlayerSocketId = room.host.socketId
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

    // Piocher des cartes jusqu'à avoir 5 cartes en main
    socket.on('drawCards', () => {
      const result = findPlayerRoom(socket.id)
      if (!result) {
        socket.emit('error', { message: 'Vous n\'êtes pas dans une partie' })
        return
      }

      const { room, isHost } = result
      const player = isHost ? room.host : room.guest!

      // Vérifier si c'est le tour du joueur
      if (!isPlayerTurn(room, socket.id)) {
        socket.emit('error', { message: 'Ce n\'est pas votre tour' })
        return
      }

      // Piocher jusqu'à avoir 5 cartes en main
      const cardsNeeded = 5 - player.hand.length
      if (cardsNeeded <= 0) {
        socket.emit('error', { message: 'Vous avez déjà 5 cartes en main' })
        return
      }

      const cardsToDraw = Math.min(cardsNeeded, player.deck.length)
      for (let i = 0; i < cardsToDraw; i++) {
        const card = player.deck.shift()
        if (card) {
          player.hand.push(card)
        }
      }

      // Envoyer de l'état aux 2 joueurs
      const hostSocket = io.sockets.sockets.get(room.host.socketId)
      const guestSocket = io.sockets.sockets.get(room.guest!.socketId)

      if (hostSocket) {
        hostSocket.emit('gameStateUpdated', getGameState(room, room.host.userId))
      }
      if (guestSocket) {
        guestSocket.emit('gameStateUpdated', getGameState(room, room.guest!.userId))
      }

      console.log(`${player.username} a pioché ${cardsToDraw} carte(s)`)
    })

    // Jouer une carte de sa main sur le terrain
    socket.on('playCard', (data: { cardIndex: number }) => {
      const result = findPlayerRoom(socket.id)
      if (!result) {
        socket.emit('error', { message: 'Vous n\'êtes pas dans une partie' })
        return
      }

      const { room, isHost } = result
      const player = isHost ? room.host : room.guest!

      // Cas des vérifications 
      // Vérifier si c'est le tour du joueur
      if (!isPlayerTurn(room, socket.id)) {
        socket.emit('error', { message: 'Ce n\'est pas votre tour' })
        return
      }

      // Vérifier l'index de la carte
      const cardIndex = data.cardIndex
      if (cardIndex === undefined || cardIndex < 0 || cardIndex >= player.hand.length) {
        socket.emit('error', { message: 'Index de carte invalide' })
        return
      }

      // Vérifier qu'il n'y a pas déjà une carte active
      if (player.activeCard !== null) {
        socket.emit('error', { message: 'Vous avez déjà une carte active sur le terrain' })
        return
      }

      // Enlève la carte de la main et la met sur le terrain
      const card = player.hand.splice(cardIndex, 1)[0]
      player.activeCard = card

      // Envoyer l'état mis à jour aux deux joueurs
      const hostSocket = io.sockets.sockets.get(room.host.socketId)
      const guestSocket = io.sockets.sockets.get(room.guest!.socketId)

      if (hostSocket) {
        hostSocket.emit('gameStateUpdated', getGameState(room, room.host.userId))
      }
      if (guestSocket) {
        guestSocket.emit('gameStateUpdated', getGameState(room, room.guest!.userId))
      }

      console.log(`${player.username} a joué ${card.name} sur le terrain`)
    })

    socket.on('attack', () => {
      const result = findPlayerRoom(socket.id)
      if (!result) {
        socket.emit('error', { message: 'Vous n\'êtes pas dans une partie' })
        return
      }

      const { room, isHost } = result
      const attacker = isHost ? room.host : room.guest!
      const defender = isHost ? room.guest! : room.host

      // Cas de vérification 
      if (!isPlayerTurn(room, socket.id)) {
        socket.emit('error', { message: 'Ce n\'est pas votre tour' })
        return
      }

      if (!attacker.activeCard) {
        socket.emit('error', { message: 'Vous n\'avez pas de carte active' })
        return
      }

      if (!defender.activeCard) {
        socket.emit('error', { message: 'L\'adversaire n\'a pas de carte active' })
        return
      }

      // Calculer les dégâts avec le multiplicateur de faiblesse
      const attackerType = attacker.activeCard.type as PokemonType
      const defenderType = defender.activeCard.type as PokemonType
      const damage = calculateDamage(attacker.activeCard.attack, attackerType, defenderType)

      // Appliquer les dégâts
      defender.activeCard.hp -= damage

      console.log(`${attacker.username} attaque avec ${attacker.activeCard.name} et inflige ${damage} dégâts`)

      // Vérifier si la carte adverse est KO
      if (defender.activeCard.hp <= 0) {
        console.log(`${defender.activeCard.name} est KO!`)
        defender.activeCard = null
        attacker.score += 1

        // Vérifier la victoire (3 points)
        if (attacker.score >= 3) {
          console.log(`${attacker.username} a gagné la partie!`)

          const hostSocket = io.sockets.sockets.get(room.host.socketId)
          const guestSocket = io.sockets.sockets.get(room.guest!.socketId)

          const gameEndData = {
            winner: attacker.username,
            finalScore: {
              [room.host.username]: room.host.score,
              [room.guest!.username]: room.guest!.score,
            },
          }

          if (hostSocket) {
            hostSocket.emit('gameEnded', gameEndData)
          }
          if (guestSocket) {
            guestSocket.emit('gameEnded', gameEndData)
          }

          rooms.delete(room.id)
          return
        }
      }

      // Changement de tour
      room.currentPlayerSocketId = defender.socketId

      const hostSocket = io.sockets.sockets.get(room.host.socketId)
      const guestSocket = io.sockets.sockets.get(room.guest!.socketId)

      if (hostSocket) {
        hostSocket.emit('gameStateUpdated', getGameState(room, room.host.userId))
      }
      if (guestSocket) {
        guestSocket.emit('gameStateUpdated', getGameState(room, room.guest!.userId))
      }
    })

    // Terminer son tour et passer la main à l'adversaire
    socket.on('endTurn', (data: { roomId: string | number }) => {
      const roomId = String(data.roomId)
      const room = rooms.get(roomId)

      if (!room) {
        socket.emit('error', { message: 'Room non trouvée' })
        return
      }

      const isHost = room.host.socketId === socket.id
      const isGuest = room.guest?.socketId === socket.id

      if (!isHost && !isGuest) {
        socket.emit('error', { message: 'Vous n\'êtes pas dans cette partie' })
        return
      }

      const currentPlayer = isHost ? room.host : room.guest!
      const opponent = isHost ? room.guest! : room.host

      // Vérifier si c'est le tour du joueur
      if (!isPlayerTurn(room, socket.id)) {
        socket.emit('error', { message: 'Ce n\'est pas votre tour' })
        return
      }

      // Passer le tour à l'adversaire
      room.currentPlayerSocketId = opponent.socketId

      const hostSocket = io.sockets.sockets.get(room.host.socketId)
      const guestSocket = io.sockets.sockets.get(room.guest!.socketId)

      if (hostSocket) {
        hostSocket.emit('gameStateUpdated', getGameState(room, room.host.userId))
      }
      if (guestSocket) {
        guestSocket.emit('gameStateUpdated', getGameState(room, room.guest!.userId))
      }

      console.log(`${currentPlayer.username} a terminé son tour, c'est au tour de ${opponent.username}`)
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
