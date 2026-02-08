import {NextFunction, Request, Response} from 'express'
import jwt from 'jsonwebtoken'

/**
 * Récupère les données utilisateur du token JWT
 * @typedef {Object} TokenPayload
 * @property {number} userId - ID unique de l'utilisateur
 * @property {string} email - Adresse email de l'utilisateur
 */

/**
 * Étend l'interface Request d'Express pour ajouter les données utilisateur
 */
declare global {
    namespace Express {
        interface Request {
            /**
             * Objet contenant les données de l'utilisateur authentifié
             * Défini par le middleware authenticateToken après vérification du JWT
             */
            user?: {
                userId: number
                email: string
            }
        }
    }
}

/**
 * Middleware d'authentification JWT
 * 
 * Vérifie la validité du token JWT fourni dans l'en-tête Authorization.
 * Le token doit être au format "Bearer <JWT_TOKEN>".
 * 
 * Si le token est valide, les données de l'utilisateur (userId et email) sont
 * ajoutées à req.user et la requête est transmise au middleware suivant.
 * 
 * @param {Request} req - Objet requête Express
 * @param {Response} res - Objet réponse Express
 * @param {NextFunction} next - Fonction pour passer au middleware suivant
 * @returns {void}
 * @throws {401} Token manquant en en-tête Authorization
 * @throws {401} Token invalide ou expiré
 * 
 * @example
 * // Utilisation comme middleware de route protégée
 * router.get('/protected', authenticateToken, (req, res) => {
 *   console.log(req.user?.userId) // ID utilisateur authentifié
 *   res.json({ data: 'Données privées' })
 * })
 * 
 * @async
 */
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