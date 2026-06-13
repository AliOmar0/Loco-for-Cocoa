import { neon } from "@neondatabase/serverless";
import type { Recipe, RecipeCollection } from "../src/types.js";
import { getDatabaseUrl } from "./config.js";

export type CloudArchive = {
  recipes: Recipe[];
  collections: RecipeCollection[];
  version: number;
  updatedAt: string | null;
  initialized: boolean;
};

type ArchiveRow = {
  recipes: Recipe[];
  collections: RecipeCollection[];
  version: string | number;
  updated_at: string | Date;
};

function database() {
  return neon(getDatabaseUrl());
}

let schemaReady: Promise<void> | undefined;

async function readyDatabase() {
  const sql = database();
  schemaReady ||= sql
    .transaction((tx) => [
      tx`
        CREATE TABLE IF NOT EXISTS archive_state (
          owner_email TEXT PRIMARY KEY,
          recipes JSONB NOT NULL DEFAULT '[]'::jsonb,
          collections JSONB NOT NULL DEFAULT '[]'::jsonb,
          version BIGINT NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      tx`
        CREATE TABLE IF NOT EXISTS archive_revisions (
          id BIGSERIAL PRIMARY KEY,
          owner_email TEXT NOT NULL,
          recipes JSONB NOT NULL,
          collections JSONB NOT NULL,
          version BIGINT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      tx`
        CREATE INDEX IF NOT EXISTS archive_revisions_owner_created_idx
        ON archive_revisions (owner_email, created_at DESC)
      `,
      tx`
        CREATE TABLE IF NOT EXISTS recipe_views (
          recipe_id TEXT NOT NULL,
          visitor_id TEXT NOT NULL,
          viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
          viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (recipe_id, visitor_id, viewed_on)
        )
      `,
      tx`
        CREATE INDEX IF NOT EXISTS recipe_views_recipe_idx
        ON recipe_views (recipe_id)
      `,
    ])
    .then(() => undefined)
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  await schemaReady;
  return sql;
}

function mapArchive(row: ArchiveRow): CloudArchive {
  return {
    recipes: row.recipes,
    collections: row.collections,
    version: Number(row.version),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    initialized: true,
  };
}

export async function loadArchive(ownerEmail: string): Promise<CloudArchive> {
  const sql = await readyDatabase();
  const rows = await sql`
    SELECT recipes, collections, version, updated_at
    FROM archive_state
    WHERE owner_email = ${ownerEmail}
    LIMIT 1
  `;
  const row = rows[0] as ArchiveRow | undefined;
  return row
    ? mapArchive(row)
    : {
        recipes: [],
        collections: [],
        version: 0,
        updatedAt: null,
        initialized: false,
      };
}

export async function saveArchive(
  ownerEmail: string,
  recipes: Recipe[],
  collections: RecipeCollection[],
): Promise<CloudArchive> {
  const sql = await readyDatabase();
  const recipesJson = JSON.stringify(recipes);
  const collectionsJson = JSON.stringify(collections);
  const results = await sql.transaction((tx) => [
    tx`
      INSERT INTO archive_revisions (
        owner_email,
        recipes,
        collections,
        version
      )
      SELECT owner_email, recipes, collections, version
      FROM archive_state
      WHERE owner_email = ${ownerEmail}
    `,
    tx`
      INSERT INTO archive_state (
        owner_email,
        recipes,
        collections,
        version
      )
      VALUES (
        ${ownerEmail},
        ${recipesJson}::jsonb,
        ${collectionsJson}::jsonb,
        1
      )
      ON CONFLICT (owner_email)
      DO UPDATE SET
        recipes = EXCLUDED.recipes,
        collections = EXCLUDED.collections,
        version = archive_state.version + 1,
        updated_at = NOW()
      RETURNING recipes, collections, version, updated_at
    `,
    tx`
      DELETE FROM archive_revisions
      WHERE id IN (
        SELECT id
        FROM archive_revisions
        WHERE owner_email = ${ownerEmail}
        ORDER BY created_at DESC
        OFFSET 30
      )
    `,
  ]);
  const row = results[1][0] as ArchiveRow | undefined;
  if (!row) throw new Error("Archive sync returned no data.");
  return mapArchive(row);
}

export async function recordRecipeView(recipeId: string, visitorId: string) {
  const sql = await readyDatabase();
  await sql`
    INSERT INTO recipe_views (recipe_id, visitor_id)
    VALUES (${recipeId}, ${visitorId})
    ON CONFLICT (recipe_id, visitor_id, viewed_on)
    DO UPDATE SET viewed_at = NOW()
  `;
}

export async function loadRecipeViews() {
  const sql = await readyDatabase();
  const rows = await sql`
    SELECT recipe_id, COUNT(*)::int AS views
    FROM recipe_views
    GROUP BY recipe_id
  `;
  return new Map(
    rows.map((row) => [String(row.recipe_id), Number(row.views)]),
  );
}
