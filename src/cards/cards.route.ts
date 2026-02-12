import { Request, Response, Router } from 'express';
import { prisma } from "../database";

export const cardsRouter = Router();

/**
 * Route GET /api/cards
 * 
 * Récupère la liste complète de toutes les cartes Pokémon disponibles
 * dans la base de données, triées par numéro Pokédex croissant.
 * 
 * Cette route est publique et ne nécessite pas d'authentification.
 * Elle est utilisée pour afficher le catalogue des cartes disponibles
 * lors de la création ou modification d'un deck.
 * 
 * @param {Request} _req - Objet requête Express (non utilisé)
 * @param {Response} res - Objet réponse Express
 * 
 * @returns {Array<Card>} 200 - Tableau de toutes les cartes disponibles
 * @throws {500} Erreur serveur lors de la récupération
 * 
 * @example
 * GET /api/cards
 * 
 * Response 200: [\n *   { "id": 1, "name": "Bulbizarre", "pokedexNumber": 1, ... },\n *   ...\n * ]\n */
cardsRouter.get('/', async (_req: Request, res: Response) => {
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
