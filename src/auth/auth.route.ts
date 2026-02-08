import {Request, Response, Router} from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {prisma} from "../database";
import {env} from "../env";

export const authRouter = Router()

/**
 * Route POST /api/auth/sign-up
 * 
 * Crée un nouvel utilisateur dans la base de données et génère un token JWT.
 * Le mot de passe est hashé avec bcrypt avant d'être stocké.
 * 
 * @param {Object} req.body - Données de l'utilisateur
 * @param {string} req.body.email - Adresse email unique
 * @param {string} req.body.username - Nom d'utilisateur unique
 * @param {string} req.body.password - Mot de passe (sera hashé avec bcrypt)
 * 
 * @returns {Object} 201 - Token JWT et données utilisateur créé
 * @throws {400} Données manquantes
 * @throws {409} Email déjà utilisé
 * @throws {500} Erreur serveur
 * 
 * @example
 * POST /api/auth/sign-up
 * { "email": "alice@example.com", "username": "alice", "password": "SecurePassword123!" }
 * 
 * @async
 */
authRouter.post('/sign-up', async (req: Request, res: Response) => {
    const {email, username, password} = req.body

    try {
        if (!email || !username || !password) {
            return res.status(400).json({error: 'Données manquantes'})
        }

        const existingUser = await prisma.user.findUnique({
            where: {email},
        })

        if (existingUser) {
            return res.status(409).json({error: 'Email déjà utilisé'})
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
            },
        })

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            env.JWT_SECRET,
            {expiresIn: '7d'}, // Expire dans 7 jours
        )

        return res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        })
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error)
        return res.status(500).json({error: 'Erreur serveur'})
    }
})

/**
 * Route POST /api/auth/sign-in
 * 
 * Authentifie un utilisateur existant en validant ses identifiants.
 * Génère et retourne un token JWT valide 7 jours.
 * 
 * @param {Object} req.body - Identifiants de l'utilisateur
 * @param {string} req.body.email - Adresse email enregistrée
 * @param {string} req.body.password - Mot de passe en clair
 * 
 * @returns {Object} 200 - Token JWT et données utilisateur
 * @throws {400} Données manquantes
 * @throws {401} Email ou mot de passe incorrect
 * @throws {500} Erreur serveur
 * 
 * @example
 * POST /api/auth/sign-in
 * { "email": "alice@example.com", "password": "SecurePassword123!" }
 * 
 * @async
 */
authRouter.post('/sign-in', async (req: Request, res: Response) => {
    const {email, password} = req.body

    try {
        if (!email || !password) {
            return res.status(400).json({error: 'Données manquantes'})
        }

        const user = await prisma.user.findUnique({
            where: {email},
        })

        if (!user) {
            return res.status(401).json({error: 'Email ou mot de passe incorrect'})
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            return res.status(401).json({error: 'Email ou mot de passe incorrect'})
            // Marquer sa afin d'éviter les brute-force
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            env.JWT_SECRET,
            {expiresIn: '7d'},
        )

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        })
    } catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({error: 'Erreur serveur'})
    }
})