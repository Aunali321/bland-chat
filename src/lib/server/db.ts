import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_PATH || 'data/bland-chat.sqlite';

const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: 'drizzle' });
