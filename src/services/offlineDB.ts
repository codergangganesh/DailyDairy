/**
 * offlineDB.ts
 * Manages a local IndexedDB for DreamVault.
 *
 * Stores:
 *  - "entries"  – cached encrypted entry rows (mirrors Supabase shape)
 *  - "security" – cached diary_security rows
 *  - "outbox"   – pending mutations to sync when online
 *
 * The outbox records have the shape:
 *   { id, table, operation, payload, userId, createdAt }
 *
 * We use a single DB version so upgrades are easy to reason about.
 */

const DB_NAME = 'dreamvault_offline';
const DB_VERSION = 1;

export type OutboxOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface OutboxRecord {
  id: string;           // local UUID
  table: string;        // 'entries' | 'diary_security' | 'profiles' | 'diaries'
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  userId: string;
  createdAt: string;
}

// ── Open DB ────────────────────────────────────────────────────────────────
let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Entries cache
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('by_user', 'user_id');
        store.createIndex('by_page', 'page_number');
      }

      // Diary security cache
      if (!db.objectStoreNames.contains('security')) {
        const sec = db.createObjectStore('security', { keyPath: 'id' });
        sec.createIndex('by_user', 'user_id', { unique: true });
      }

      // Outbox queue
      if (!db.objectStoreNames.contains('outbox')) {
        const ob = db.createObjectStore('outbox', { keyPath: 'id' });
        ob.createIndex('by_user', 'userId');
        ob.createIndex('by_created', 'createdAt');
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Generic helpers ────────────────────────────────────────────────────────
function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = 'readonly'
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

function cursorAll<T>(store: IDBObjectStore | IDBIndex): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as T);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Entries cache ──────────────────────────────────────────────────────────
export async function idbGetEntries(userId: string): Promise<unknown[]> {
  const db = await openDB();
  const store = tx(db, 'entries').objectStore('entries');
  const idx = store.index('by_user');
  const all = await cursorAll<Record<string, unknown>>(idx);
  return all
    .filter((e) => e['user_id'] === userId)
    .sort((a, b) => (a['page_number'] as number) - (b['page_number'] as number));
}

export async function idbPutEntry(entry: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'entries', 'readwrite').objectStore('entries').put(entry));
}

export async function idbDeleteEntry(entryId: string): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'entries', 'readwrite').objectStore('entries').delete(entryId));
}

export async function idbClearEntries(userId: string): Promise<void> {
  const db = await openDB();
  const entries = await idbGetEntries(userId);
  const t = tx(db, 'entries', 'readwrite');
  for (const e of entries as Array<{ id: string }>) {
    t.objectStore('entries').delete(e.id);
  }
  await new Promise<void>((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

export async function idbBulkPutEntries(entries: Record<string, unknown>[]): Promise<void> {
  const db = await openDB();
  const t = tx(db, 'entries', 'readwrite');
  for (const e of entries) {
    t.objectStore('entries').put(e);
  }
  await new Promise<void>((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

// ── Security cache ─────────────────────────────────────────────────────────
export async function idbGetSecurity(userId: string): Promise<unknown | null> {
  const db = await openDB();
  const store = tx(db, 'security').objectStore('security');
  const idx = store.index('by_user');
  const result = await promisify<unknown>(idx.get(userId));
  return result ?? null;
}

export async function idbPutSecurity(record: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'security', 'readwrite').objectStore('security').put(record));
}

// ── Outbox ─────────────────────────────────────────────────────────────────
export async function outboxEnqueue(record: Omit<OutboxRecord, 'id' | 'createdAt'>): Promise<OutboxRecord> {
  const full: OutboxRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const db = await openDB();
  await promisify(tx(db, 'outbox', 'readwrite').objectStore('outbox').put(full));
  return full;
}

export async function outboxGetAll(userId: string): Promise<OutboxRecord[]> {
  const db = await openDB();
  const idx = tx(db, 'outbox').objectStore('outbox').index('by_user');
  const all = await cursorAll<OutboxRecord>(idx);
  return all
    .filter((r) => r.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function outboxCount(userId: string): Promise<number> {
  const all = await outboxGetAll(userId);
  return all.length;
}

export async function outboxRemove(id: string): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'outbox', 'readwrite').objectStore('outbox').delete(id));
}

export async function outboxClear(userId: string): Promise<void> {
  const records = await outboxGetAll(userId);
  const db = await openDB();
  const t = tx(db, 'outbox', 'readwrite');
  for (const r of records) {
    t.objectStore('outbox').delete(r.id);
  }
  await new Promise<void>((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
