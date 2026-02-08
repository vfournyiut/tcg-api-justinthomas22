import { Router, Request, Response } from "express";
import { prisma } from "../database";
import { authenticateToken } from "../auth/auth.middleware";

export const decksRouter = Router();

/**
 * Route POST /api/decks
 * 
 * Crée un nouveau deck Pokémon composé de exactement 10 cartes.
 * L'utilisateur doit être authentifié (nécessite un token JWT).
 * 
 * @param {Request} req - Requête avec Authorization header
 * @param {Object} req.body - Données du deck
 * @param {string} req.body.name - Nom du deck
 * @param {Array<number>} req.body.cards - 10 numéros Pokédex
 * @param {number} req.user.userId - ID utilisateur du token
 * 
 * @returns {Object} 201 - Deck créé avec ses cartes
 * @throws {400} Nom manquant ou nombre de cartes invalide
 * @throws {401} Token manquant ou invalide
 * @throws {500} Erreur serveur
 * 
 * @async
 */
decksRouter.post("/", authenticateToken, async (req: Request, res: Response) => {
    const { name, cards } = req.body;
    const userId = req.user!.userId;

    if (!name) 
        return res.status(400).json({ error: "Nom manquant" });
    if (!cards || !Array.isArray(cards) || cards.length !== 10)
        return res.status(400).json({ error: "Le deck doit contenir exactement 10 cartes" });

    try {
        const validCards = await prisma.card.findMany({
        where: { pokedexNumber: { in: cards } },
        });

        if (validCards.length !== 10)
            return res.status(400).json({ error: "Cartes invalides ou inexistantes" });

        const deck = await prisma.deck.create({
        data: {
            name,
            userId,
            deckCards: {
            create: validCards.map((card) => ({ cardId: card.id })),
            },
        },
        include: { deckCards: { include: { card: true } } },
        });


        return res.status(201).json(deck);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * Route GET /api/decks/mine
 * 
 * Récupère la liste de tous les decks de l'utilisateur authentifié.
 * 
 * @param {Request} req - Requête avec Authorization header
 * @param {number} req.user.userId - ID utilisateur du token
 * 
 * @returns {Array<Deck>} 200 - Tableau des decks de l'utilisateur
 * @throws {401} Token manquant ou invalide
 * @throws {500} Erreur serveur
 * 
 * @async
 */
decksRouter.get("/mine", authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    try {
        const decks = await prisma.deck.findMany({
            where: { userId },
            include: { deckCards: { include: { card: true } } },
        });

        return res.status(200).json(decks);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * Route GET /api/decks/:id
 * 
 * Récupère un deck spécifique. L'utilisateur ne peut accéder qu'à ses propres decks.
 * 
 * @param {Request} req - Requête avec Authorization header et id dans les params
 * @param {string} req.params.id - ID du deck
 * @param {number} req.user.userId - ID utilisateur du token
 * 
 * @returns {Object} 200 - Détails du deck
 * @throws {401} Token manquant ou invalide
 * @throws {403} Accès refusé (pas propriétaire)
 * @throws {404} Deck inexistant
 * @throws {500} Erreur serveur
 * 
 * @async
 */
decksRouter.get("/:id", authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    try {
        const deck = await prisma.deck.findUnique({
            where: { id: Number(id) },
            include: { deckCards: { include: { card: true } } },
        });

        if (!deck) 
            return res.status(404).json({ error: "Deck inexistant" });
        if (deck.userId !== userId) 
            return res.status(403).json({ error: "Accès refusé" });

        return res.status(200).json(deck);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * Route PATCH /api/decks/:id
 * 
 * Met à jour un deck (nom et/ou cartes). L'utilisateur ne peut modifier que ses propres decks.
 * Si les cartes sont modifiées, elles doivent être exactement 10.
 * 
 * @param {Request} req - Requête avec Authorization header et id dans les params
 * @param {string} req.params.id - ID du deck
 * @param {Object} req.body - Données à mettre à jour
 * @param {string} [req.body.name] - Nouveau nom (optionnel)
 * @param {Array<number>} [req.body.cards] - Nouvelles cartes (optionnel, doit être 10 si fourni)
 * @param {number} req.user.userId - ID utilisateur du token
 * 
 * @returns {Object} 200 - Deck mis à jour
 * @throws {400} Nombre de cartes invalide
 * @throws {401} Token manquant ou invalide
 * @throws {403} Accès refusé (pas propriétaire)
 * @throws {404} Deck inexistant
 * @throws {500} Erreur serveur
 * 
 * @async
 */
decksRouter.patch("/:id", authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, cards } = req.body;
    const userId = req.user!.userId;

    try {
        const deck = await prisma.deck.findUnique({
            where: { id: Number(id) },
            include: { deckCards: true },
        });

        if (!deck) 
            return res.status(404).json({ error: "Deck inexistant" });
        if (deck.userId !== userId) 
            return res.status(403).json({ error: "Accès refusé" });

        if (cards) {
            if (!Array.isArray(cards) || cards.length !== 10)
                return res.status(400).json({ error: "Le deck doit contenir exactement 10 cartes" });

            const validCards = await prisma.card.findMany({ where: { pokedexNumber: { in: cards } } });
            if (validCards.length !== 10)
                return res.status(400).json({ error: "Cartes invalides ou inexistantes" });

            await prisma.deckCard.deleteMany({ where: { deckId: deck.id } });
            await prisma.deckCard.createMany({
                data: validCards.map((card) => ({ deckId: deck.id, cardId: card.id })),
            });
        }

        const updatedDeck = await prisma.deck.update({
            where: { id: deck.id },
            data: { name: name ?? deck.name },
            include: { deckCards: { include: { card: true } } },
        });

        return res.status(200).json(updatedDeck);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});

/**
 * Route DELETE /api/decks/:id
 * 
 * Supprime un deck et toutes ses cartes associées (irréversible).
 * L'utilisateur ne peut supprimer que ses propres decks.
 * 
 * @param {Request} req - Requête avec Authorization header et id dans les params
 * @param {string} req.params.id - ID du deck à supprimer
 * @param {number} req.user.userId - ID utilisateur du token
 * 
 * @returns {Object} 200 - Message de confirmation
 * @throws {401} Token manquant ou invalide
 * @throws {403} Accès refusé (pas propriétaire)
 * @throws {404} Deck inexistant
 * @throws {500} Erreur serveur
 * 
 * @async
 */
decksRouter.delete("/:id", authenticateToken, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    try {
        const deck = await prisma.deck.findUnique({ where: { id: Number(id) } });
        if (!deck) 
            return res.status(404).json({ error: "Deck inexistant" });
        if (deck.userId !== userId) 
            return res.status(403).json({ error: "Accès refusé" });

        await prisma.deckCard.deleteMany({ where: { deckId: deck.id } });
        await prisma.deck.delete({ where: { id: deck.id } });

        return res.status(200).json({ message: "Deck supprimé avec succès" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }
});
