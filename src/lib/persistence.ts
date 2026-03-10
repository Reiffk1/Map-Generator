import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { openDB } from 'idb';

import type { StoredWorkspace } from '../models/types';

const SQLITE_PATH = 'sqlite:wayfinder-atelier.db';
const INDEXED_DB_NAME = 'wayfinder-atelier';
const INDEXED_DB_STORE = 'workspace';
const INDEXED_DB_KEY = 'current';

let sqliteDbPromise: Promise<Database> | null = null;

const getSqlite = async () => {
  if (!isTauri()) return null;

  if (!sqliteDbPromise) {
    sqliteDbPromise = Database.load(SQLITE_PATH).then(async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS workspace_store (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      return db;
    });
  }

  return sqliteDbPromise;
};

const getIndexedDb = async () =>
  openDB(INDEXED_DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(INDEXED_DB_STORE)) {
        database.createObjectStore(INDEXED_DB_STORE);
      }
    },
  });

export const loadStoredWorkspace = async (): Promise<StoredWorkspace | null> => {
  if (isTauri()) {
    try {
      const db = await getSqlite();
      if (db) {
        const rows = await db.select<{ payload: string }[]>(
          'SELECT payload FROM workspace_store WHERE id = 1',
        );
        if (rows.length > 0) {
          return JSON.parse(rows[0].payload) as StoredWorkspace;
        }
      }
    } catch (error) {
      console.warn('SQLite workspace load failed, falling back to IndexedDB.', error);
    }
  }

  const db = await getIndexedDb();
  const payload = await db.get(INDEXED_DB_STORE, INDEXED_DB_KEY);
  return payload ? (payload as StoredWorkspace) : null;
};

export const saveStoredWorkspace = async (value: StoredWorkspace) => {
  if (isTauri()) {
    try {
      const db = await getSqlite();
      if (db) {
        const payload = JSON.stringify(value);
        const timestamp = new Date().toISOString();
        await db.execute(
          `INSERT INTO workspace_store (id, payload, updated_at)
           VALUES (1, $1, $2)
           ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
          [payload, timestamp],
        );
      }
    } catch (error) {
      console.warn('SQLite workspace save failed, falling back to IndexedDB.', error);
    }
  }

  const db = await getIndexedDb();
  await db.put(INDEXED_DB_STORE, value, INDEXED_DB_KEY);
};
