import { Request, Response, Router } from 'express';
import { prisma } from "../database";

export const cardsRouter = Router();

// GET /api/cards
cardsRouter.get('/cards', async (req: Request, res: Response) => {
    try {
        // Toute les cartes triés par pokedex numéro
        const cards = await prisma.card.findMany({
            orderBy: {
                pokedexNumber: 'asc',
            },
        });

        return res.status(200).json(cards);
    } catch (error) {
        console.error('Erreur lors de la récupération des cartes:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});
