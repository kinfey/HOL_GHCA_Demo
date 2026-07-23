import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Returns all games in deterministic title order.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @returns Every game with category and publisher summary data.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns all persisted game IDs in deterministic title order.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @returns Ordered game IDs suitable for static route generation.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns one game by ID.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @param id - The game ID to look up.
 * @returns The matching game or `null` when no game exists for the ID.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const rows = await baseGamesQuery(db).where(eq(games.id, id)).limit(1);
    return rows.length > 0 ? mapGame(rows[0]) : null;
}

/**
 * Returns all categories that are referenced by at least one game.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @returns Categories ordered by name for stable filter rendering.
 */
export async function getGameCategories(db: Database): Promise<Category[]> {
    const rows = await db
        .selectDistinct({ id: categories.id, name: categories.name })
        .from(games)
        .innerJoin(categories, eq(games.categoryId, categories.id))
        .orderBy(asc(categories.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Returns all publishers that are referenced by at least one game.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @returns Publishers ordered by name for stable filter rendering.
 */
export async function getGamePublishers(db: Database): Promise<Publisher[]> {
    const rows = await db
        .selectDistinct({ id: publishers.id, name: publishers.name })
        .from(games)
        .innerJoin(publishers, eq(games.publisherId, publishers.id))
        .orderBy(asc(publishers.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Returns games filtered by selected category IDs and/or a selected publisher ID.
 *
 * Category filtering uses OR semantics: a game matches when its category is included
 * in the provided category list.
 *
 * @param db - The database client to query. Pages pass the real client; tests pass an in-memory database.
 * @param filters - Optional category and publisher filter criteria.
 * @returns Games matching the filter criteria, ordered by title.
 */
export async function getFilteredGames(db: Database, filters: GameFilters): Promise<Game[]> {
    const categoryIds = [...new Set(filters.categoryIds ?? [])];
    const conditions: SQL[] = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (filters.publisherId !== undefined) {
        conditions.push(eq(games.publisherId, filters.publisherId));
    }

    const rows = conditions.length === 0
        ? await baseGamesQuery(db).orderBy(asc(games.title))
        : await baseGamesQuery(db).where(and(...conditions)).orderBy(asc(games.title));
    return rows.map(mapGame);
}
