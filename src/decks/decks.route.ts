import { Router, Request, Response } from "express";
import { prisma } from "../database";
import { authenticateToken } from "../auth/auth.middleware";

export const decksRouter = Router();

// POST /api/decks
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

// GET /api/decks/mine
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

// GET /api/decks/:id
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

// PATCH /api/decks/:id
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

// DELETE /api/decks/:id
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
