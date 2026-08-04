import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentBrief } from "../types/content-brief.js";
import type { IdeaProposalBatch } from "../types/idea-proposal.js";
import type { ReelScript } from "../types/reel-script.js";

type EntityType = "content_brief" | "reel_script" | "idea_proposal";

interface OperationalEntity {
  id: string;
  createdAt?: string;
  status?: string;
}

interface StoredRow {
  payload: string;
}

const databases = new Map<string, Database.Database>();

function dataDirectory(): string {
  const defaultDirectory = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  return path.resolve(process.env.CONTENT_MAKER_DATA_DIR ?? defaultDirectory);
}

function getDatabase(): Database.Database {
  const directory = dataDirectory();
  const existing = databases.get(directory);
  if (existing) return existing;

  mkdirSync(directory, { recursive: true });
  const database = new Database(path.join(directory, "content-maker.sqlite"));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS operational_entities (
      entity_type TEXT NOT NULL,
      id TEXT NOT NULL,
      status TEXT,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (entity_type, id)
    );
    CREATE INDEX IF NOT EXISTS operational_entities_status_idx
      ON operational_entities (entity_type, status, created_at DESC);
  `);
  databases.set(directory, database);
  return database;
}

function assertEntityId(id: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    throw new Error(`Invalid operational entity ID: ${id}`);
  }
}

export class SqliteOperationalRepository<T extends OperationalEntity> {
  private legacyImported = false;

  constructor(
    private readonly entityType: EntityType,
    private readonly legacySubdirectory: string
  ) {}

  private async importLegacyFiles(): Promise<void> {
    if (this.legacyImported) return;
    const legacyDirectory = path.join(dataDirectory(), this.legacySubdirectory);
    const files = await readdir(legacyDirectory).catch(() => [] as string[]);
    const database = getDatabase();
    const insert = database.prepare(`
      INSERT OR IGNORE INTO operational_entities
        (entity_type, id, status, created_at, payload, updated_at)
      VALUES
        (@entityType, @id, @status, @createdAt, @payload, @updatedAt)
    `);
    const importRows = database.transaction(
      (rows: Array<{ entity: T; payload: string }>) => {
        for (const { entity, payload } of rows) {
          assertEntityId(entity.id);
          insert.run({
            entityType: this.entityType,
            id: entity.id,
            status: entity.status ?? null,
            createdAt: entity.createdAt ?? new Date(0).toISOString(),
            payload,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    );

    const rows: Array<{ entity: T; payload: string }> = [];
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const payload = await readFile(path.join(legacyDirectory, file), "utf-8");
      rows.push({ entity: JSON.parse(payload) as T, payload });
    }
    importRows(rows);
    this.legacyImported = true;
  }

  async get(id: string): Promise<T> {
    assertEntityId(id);
    await this.importLegacyFiles();
    const row = getDatabase()
      .prepare(
        "SELECT payload FROM operational_entities WHERE entity_type = ? AND id = ?"
      )
      .get(this.entityType, id) as StoredRow | undefined;
    if (!row) throw new Error(`${this.entityType} not found: ${id}`);
    return JSON.parse(row.payload) as T;
  }

  async list(): Promise<T[]> {
    await this.importLegacyFiles();
    const rows = getDatabase()
      .prepare(
        "SELECT payload FROM operational_entities WHERE entity_type = ? ORDER BY created_at DESC"
      )
      .all(this.entityType) as StoredRow[];
    return rows.map((row) => JSON.parse(row.payload) as T);
  }

  async save(entity: T): Promise<void> {
    assertEntityId(entity.id);
    await this.importLegacyFiles();
    const now = new Date().toISOString();
    getDatabase()
      .prepare(`
        INSERT INTO operational_entities
          (entity_type, id, status, created_at, payload, updated_at)
        VALUES
          (@entityType, @id, @status, @createdAt, @payload, @updatedAt)
        ON CONFLICT(entity_type, id) DO UPDATE SET
          status = excluded.status,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `)
      .run({
        entityType: this.entityType,
        id: entity.id,
        status: entity.status ?? null,
        createdAt: entity.createdAt ?? now,
        payload: JSON.stringify(entity),
        updatedAt: now,
      });
  }
}

export const contentBriefRepository = new SqliteOperationalRepository<ContentBrief>(
  "content_brief",
  "content-briefs"
);
export const reelScriptRepository = new SqliteOperationalRepository<ReelScript>(
  "reel_script",
  "reel-scripts"
);
export const ideaProposalRepository = new SqliteOperationalRepository<IdeaProposalBatch>(
  "idea_proposal",
  "idea-proposals"
);
