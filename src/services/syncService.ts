/**
 * syncService.ts
 * Drains the IndexedDB outbox and pushes changes to Supabase.
 *
 * Called:
 *  - On app mount (if online)
 *  - On window "online" event
 *  - Manually from the Settings UI
 *
 * Each outbox record describes one mutation:
 *   CREATE / UPDATE / DELETE  on a specific Supabase table.
 *
 * The service is a no-op when Supabase is not configured.
 */

import { supabase, isSupabaseConfigured } from './dbService';
import {
  outboxGetAll,
  outboxRemove,
  idbBulkPutEntries,
  idbPutSecurity,
  idbGetSecurity,
  type OutboxRecord,
} from './offlineDB';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncResult {
  synced: number;
  failed: number;
  status: SyncStatus;
  error?: string;
}

// Global listeners so the React context can react to sync events
type SyncListener = (result: SyncResult) => void;
const listeners: Set<SyncListener> = new Set();

export function onSyncComplete(cb: SyncListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(result: SyncResult) {
  listeners.forEach((l) => l(result));
}

// ── Apply one outbox record to Supabase ────────────────────────────────────
async function applyRecord(record: OutboxRecord): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { table, operation, payload } = record;

  if (operation === 'CREATE') {
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw error;
  } else if (operation === 'UPDATE') {
    const { id, ...rest } = payload as { id: string } & Record<string, unknown>;
    const { error } = await supabase.from(table).update(rest).eq('id', id);
    if (error) throw error;
  } else if (operation === 'DELETE') {
    const { id } = payload as { id: string };
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  }
}

// ── Main sync function ─────────────────────────────────────────────────────
export async function syncOutbox(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { synced: 0, failed: 0, status: 'idle' };
  }

  if (!navigator.onLine) {
    emit({ synced: 0, failed: 0, status: 'offline' });
    return { synced: 0, failed: 0, status: 'offline' };
  }

  const pending = await outboxGetAll(userId);
  if (pending.length === 0) {
    const result: SyncResult = { synced: 0, failed: 0, status: 'success' };
    emit(result);
    return result;
  }

  emit({ synced: 0, failed: 0, status: 'syncing' });

  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const record of pending) {
    try {
      await applyRecord(record);
      await outboxRemove(record.id);
      synced++;
    } catch (err: unknown) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[sync] Failed to apply ${record.operation} on ${record.table}:`, lastError);
      // Don't abort — try remaining records
    }
  }

  const result: SyncResult = {
    synced,
    failed,
    status: failed === 0 ? 'success' : 'error',
    error: lastError,
  };
  emit(result);
  return result;
}

// ── Pull remote entries into the local IDB cache ───────────────────────────
export async function pullRemoteEntries(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !navigator.onLine) return;

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('page_number', { ascending: true });

  if (error) {
    console.warn('[sync] Failed to pull remote entries:', error.message);
    return;
  }

  if (data && data.length > 0) {
    await idbBulkPutEntries(data as Record<string, unknown>[]);
  }
}

// ── Pull remote security record into IDB ───────────────────────────────────
export async function pullRemoteSecurity(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !navigator.onLine) return;

  // Only pull if we have nothing cached yet
  const existing = await idbGetSecurity(userId);
  if (existing) return;

  const { data, error } = await supabase
    .from('diary_security')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return;

  await idbPutSecurity(data as Record<string, unknown>);
}

// ── Register window online listener (call once at app startup) ─────────────
let _listenerRegistered = false;

export function registerOnlineListener(getUserId: () => string | null): void {
  if (_listenerRegistered) return;
  _listenerRegistered = true;

  window.addEventListener('online', async () => {
    const uid = getUserId();
    if (uid) {
      console.info('[sync] Network restored — running outbox sync…');
      await syncOutbox(uid);
    }
  });
}
