import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/database";
import { CardModel } from "../src/generated/prisma/models/Card";
import { PokemonType } from "../src/generated/prisma/enums";

// Tire au sort un nombre de carte choisis
function getRandomCards(cards: CardModel[], count: number): CardModel[] {
    const shuffled = [...cards].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

async function main() {
    console.log("🌱 Starting database seed...");

    await prisma.deckCard.deleteMany();
    await prisma.deck.deleteMany();
    await prisma.card.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);

    await prisma.user.createMany({
        data: [
            {
                username: "red",
                email: "red@example.com",
                password: hashedPassword,
            },
            {
                username: "blue",
                email: "blue@example.com",
                password: hashedPassword,
            },
        ],
    });

    const redUser = await prisma.user.findUnique({ where: { email: "red@example.com" } });
    const blueUser = await prisma.user.findUnique({ where: { email: "blue@example.com" } });

    if (!redUser || !blueUser) {
        throw new Error("Failed to create users");
    }

    const pokemonDataPath = join(__dirname, "data", "pokemon.json");
    const pokemonJson = readFileSync(pokemonDataPath, "utf-8");
    const pokemonData: CardModel[] = JSON.parse(pokemonJson);

    await Promise.all(
        pokemonData.map((pokemon) =>
            prisma.card.create({
                data: {
                    name: pokemon.name,
                    hp: pokemon.hp,
                    attack: pokemon.attack,
                    type: PokemonType[pokemon.type as keyof typeof PokemonType],
                    pokedexNumber: pokemon.pokedexNumber,
                    imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`,
                },
            })
        )
    );

    const allCards = await prisma.card.findMany();

    // Création des decks
    const redDeck = await prisma.deck.create({
        data: {
            name: "Starter Deck",
            userId: redUser.id,
        },
    });

    const blueDeck = await prisma.deck.create({
        data: {
            name: "Starter Deck",
            userId: blueUser.id,
        },
    });

    const redCards = getRandomCards(allCards, 10);
    const blueCards = getRandomCards(allCards, 10);

    await prisma.deckCard.createMany({
        data: redCards.map((card) => ({
            deckId: redDeck.id,
            cardId: card.id,
        })),
    });

    await prisma.deckCard.createMany({
        data: blueCards.map((card) => ({
            deckId: blueDeck.id,
            cardId: card.id,
        })),
    });

    console.log("\n🎉 Database seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
