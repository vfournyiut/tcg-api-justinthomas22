import type { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { env } from '../env'

// Données stockées après authentification
interface UserData {
  userId: number
  email: string
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  })

  // Middleware d'authentification
  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error('Token manquant'))
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as UserData
      socket.data.userId = decoded.userId
      socket.data.email = decoded.email
      next()
    } catch {
      next(new Error('Token invalide ou expiré'))
    }
  })

  return io
}
