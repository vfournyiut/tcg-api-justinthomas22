import {NextFunction, Request, Response} from 'express'
import jwt from 'jsonwebtoken'

declare global {
    namespace Express {
        interface Request {
            userId?: number
        }
    }
}

export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Format: "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({error: 'Token manquant'})
    }

    try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: number
        email: string
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email
    }
    return next()
    } catch (error) {
      return res.status(401).json({error: 'Token invalide ou expiré'})
    }
}