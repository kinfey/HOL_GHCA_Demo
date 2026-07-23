import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getFilteredGames,
    getGameCategories,
    getGamePublishers,
} from './games';

interface SeededCatalog {
    strategyCategoryId: number;
    puzzleCategoryId: number;
    alphaPublisherId: number;
    betaPublisherId: number;
}

async function seedCatalog(db: Database): Promise<SeededCatalog> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [alphaPublisher] = await db
        .insert(publishers)
        .values({ name: 'Alpha Pub', description: 'pub' })
        .returning({ id: publishers.id });
    const [betaPublisher] = await db
        .insert(publishers)
        .values({ name: 'Beta Pub', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Zen Puzzles',
            description: 'Description 4',
            starRating: 4.2,
            categoryId: puzzleCategory.id,
            publisherId: betaPublisher.id,
        },
        {
            title: 'Puzzle Forge',
            description: 'Description 3',
            starRating: 4.2,
            categoryId: puzzleCategory.id,
            publisherId: alphaPublisher.id,
        },
        {
            title: 'Beta Strategies',
            description: 'Description 2',
            starRating: 4.2,
            categoryId: strategyCategory.id,
            publisherId: betaPublisher.id,
        },
        {
            title: 'Alpha Strategies',
            description: 'Description 1',
            starRating: 4.2,
            categoryId: strategyCategory.id,
            publisherId: alphaPublisher.id,
        },
    ]);

    return {
        strategyCategoryId: strategyCategory.id,
        puzzleCategoryId: puzzleCategory.id,
        alphaPublisherId: alphaPublisher.id,
        betaPublisherId: betaPublisher.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedCatalog(db);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual([
            'Alpha Strategies',
            'Beta Strategies',
            'Puzzle Forge',
            'Zen Puzzles',
        ]);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Alpha Pub' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedCatalog(db);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedCatalog(db);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Alpha Strategies');
    });

    it('returns null for a non-existent game', async () => {
        await seedCatalog(db);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('returns available game categories in name order', async () => {
        await seedCatalog(db);
        const allCategories = await getGameCategories(db);
        expect(allCategories).toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
    });

    it('returns available game publishers in name order', async () => {
        await seedCatalog(db);
        const allPublishers = await getGamePublishers(db);
        expect(allPublishers).toEqual([
            { id: expect.any(Number), name: 'Alpha Pub' },
            { id: expect.any(Number), name: 'Beta Pub' },
        ]);
    });

    it('filters games by one category', async () => {
        const seededCatalog = await seedCatalog(db);
        const filteredGames = await getFilteredGames(db, {
            categoryIds: [seededCatalog.strategyCategoryId],
        });

        expect(filteredGames.map((game) => game.title)).toEqual([
            'Alpha Strategies',
            'Beta Strategies',
        ]);
    });

    it('filters games by one publisher', async () => {
        const seededCatalog = await seedCatalog(db);
        const filteredGames = await getFilteredGames(db, {
            publisherId: seededCatalog.betaPublisherId,
        });

        expect(filteredGames.map((game) => game.title)).toEqual([
            'Beta Strategies',
            'Zen Puzzles',
        ]);
    });

    it('combines category and publisher filters', async () => {
        const seededCatalog = await seedCatalog(db);
        const filteredGames = await getFilteredGames(db, {
            categoryIds: [seededCatalog.strategyCategoryId],
            publisherId: seededCatalog.betaPublisherId,
        });

        expect(filteredGames.map((game) => game.title)).toEqual(['Beta Strategies']);
    });

    it('applies OR semantics across multiple categories', async () => {
        const seededCatalog = await seedCatalog(db);
        const filteredGames = await getFilteredGames(db, {
            categoryIds: [seededCatalog.strategyCategoryId, seededCatalog.puzzleCategoryId],
            publisherId: seededCatalog.alphaPublisherId,
        });

        expect(filteredGames.map((game) => game.title)).toEqual([
            'Alpha Strategies',
            'Puzzle Forge',
        ]);
    });

    it('returns an empty collection when filters match nothing', async () => {
        await seedCatalog(db);
        const filteredGames = await getFilteredGames(db, {
            categoryIds: [-1],
            publisherId: -1,
        });

        expect(filteredGames).toEqual([]);
    });
});
