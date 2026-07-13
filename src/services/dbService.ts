import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  idbGetEntries,
  idbPutEntry,
  idbDeleteEntry,
  idbBulkPutEntries,
  idbGetSecurity,
  idbPutSecurity,
  outboxEnqueue,
} from './offlineDB';

// Types corresponding to database schema
export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user';
  created_at: string;
  suspended?: boolean;
}

export interface Diary {
  id: string;
  user_id: string;
  diary_name: string;
  created_at: string;
}

export interface DiarySecurity {
  id: string;
  user_id: string;
  password_hash: string;
  recovery_question: string;
  recovery_answer_hash: string;
  encrypted_master_key: string;
  master_key_iv: string;
  master_key_salt: string;
  recovery_encrypted_master_key: string;
  recovery_master_key_iv: string;
  recovery_master_key_salt: string;
  created_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  encrypted_content: string; // AES-GCM ciphertext of JSON { title, content, tags }
  iv: string;
  salt: string;
  mood: 'happy' | 'calm' | 'sad' | 'angry' | 'tired' | 'excited';
  category: 'Daily Journal' | 'Dream Journal' | 'Personal Notes' | 'Goals' | 'Memories' | 'Gratitude';
  page_number: number;
  is_favorite: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  username?: string;
  action: string;
  created_at: string;
}

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export let supabase: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

// LocalStorage database mock storage keys
const LS_KEYS = {
  PROFILES: 'dreamvault_profiles',
  DIARIES: 'dreamvault_diaries',
  SECURITY: 'dreamvault_security',
  ENTRIES: 'dreamvault_entries',
  LOGS: 'dreamvault_logs',
};

// Helper for localStorage operations
const getLocalData = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocalData = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const dbService = {
  // --- PROFILES ---
  async getProfile(userId: string): Promise<Profile | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }
      return data;
    } else {
      const profiles = getLocalData<Profile[]>(LS_KEYS.PROFILES, []);
      return profiles.find((p) => p.id === userId) || null;
    }
  },

  async createProfile(profile: Omit<Profile, 'created_at'>): Promise<Profile> {
    const newProfile: Profile = {
      ...profile,
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const profiles = getLocalData<Profile[]>(LS_KEYS.PROFILES, []);
      // Check if username already exists
      if (profiles.some(p => p.username === profile.username && p.id !== profile.id)) {
        throw new Error('Username already taken');
      }
      // Remove any existing profile with same ID
      const filtered = profiles.filter(p => p.id !== profile.id);
      filtered.push(newProfile);
      setLocalData(LS_KEYS.PROFILES, filtered);
      return newProfile;
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const profiles = getLocalData<Profile[]>(LS_KEYS.PROFILES, []);
      const index = profiles.findIndex((p) => p.id === userId);
      if (index === -1) throw new Error('Profile not found');
      
      profiles[index] = { ...profiles[index], ...updates };
      setLocalData(LS_KEYS.PROFILES, profiles);
      return profiles[index];
    }
  },

  async getAllProfiles(): Promise<Profile[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalData<Profile[]>(LS_KEYS.PROFILES, []);
    }
  },

  // --- DIARIES ---
  async getDiaries(userId: string): Promise<Diary[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    } else {
      const diaries = getLocalData<Diary[]>(LS_KEYS.DIARIES, []);
      return diaries.filter((d) => d.user_id === userId);
    }
  },

  async createDiary(userId: string, diaryName: string): Promise<Diary> {
    const newDiary: Diary = {
      id: crypto.randomUUID(),
      user_id: userId,
      diary_name: diaryName,
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data, error } = await supabase
        .from('diaries')
        .insert(newDiary)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const diaries = getLocalData<Diary[]>(LS_KEYS.DIARIES, []);
      diaries.push(newDiary);
      setLocalData(LS_KEYS.DIARIES, diaries);
      return newDiary;
    }
  },

  // --- DIARY SECURITY ---
  async getDiarySecurity(userId: string): Promise<DiarySecurity | null> {
    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('diary_security')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }
        if (data) await idbPutSecurity(data as unknown as Record<string, unknown>);
        return data;
      } catch (err) {
        console.warn('[dbService] getDiarySecurity falling back to IDB:', err);
      }
    }

    // Offline — try IDB first
    const cached = await idbGetSecurity(userId);
    if (cached) return cached as DiarySecurity;

    // Then LS
    const securityList = getLocalData<DiarySecurity[]>(LS_KEYS.SECURITY, []);
    return securityList.find((s) => s.user_id === userId) || null;
  },

  async createDiarySecurity(securityRecord: Omit<DiarySecurity, 'id' | 'created_at'>): Promise<DiarySecurity> {
    const newRecord: DiarySecurity = {
      ...securityRecord,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // Always cache locally
    await idbPutSecurity(newRecord as unknown as Record<string, unknown>);

    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('diary_security')
          .insert(newRecord)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[dbService] createDiarySecurity offline — queuing outbox:', err);
      }
    }

    if (supabase) {
      await outboxEnqueue({
        table: 'diary_security',
        operation: 'CREATE',
        payload: newRecord as unknown as Record<string, unknown>,
        userId: securityRecord.user_id,
      });
    } else {
      const securityList = getLocalData<DiarySecurity[]>(LS_KEYS.SECURITY, []);
      const filtered = securityList.filter((s) => s.user_id !== securityRecord.user_id);
      filtered.push(newRecord);
      setLocalData(LS_KEYS.SECURITY, filtered);
    }

    return newRecord;
  },

  async updateDiarySecurity(userId: string, updates: Partial<DiarySecurity>): Promise<DiarySecurity> {
    // Read current from IDB
    const cached = (await idbGetSecurity(userId)) as DiarySecurity | null;
    const merged: DiarySecurity = { ...(cached ?? ({} as DiarySecurity)), ...updates } as DiarySecurity;

    // Write back
    await idbPutSecurity(merged as unknown as Record<string, unknown>);

    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('diary_security')
          .update(updates)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[dbService] updateDiarySecurity offline — queuing outbox:', err);
      }
    }

    if (supabase) {
      await outboxEnqueue({
        table: 'diary_security',
        operation: 'UPDATE',
        payload: { id: merged.id, ...updates } as Record<string, unknown>,
        userId,
      });
    } else {
      const securityList = getLocalData<DiarySecurity[]>(LS_KEYS.SECURITY, []);
      const index = securityList.findIndex((s) => s.user_id === userId);
      if (index === -1) throw new Error('Diary security record not found');
      securityList[index] = { ...securityList[index], ...updates };
      setLocalData(LS_KEYS.SECURITY, securityList);
      return securityList[index];
    }

    return merged;
  },

  // --- ENTRIES ---
  async getEntries(userId: string): Promise<Entry[]> {
    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', userId)
          .order('page_number', { ascending: true });
        if (error) throw error;
        const rows = (data || []) as Entry[];
        // Refresh IDB cache
        await idbBulkPutEntries(rows as unknown as Record<string, unknown>[]);
        return rows;
      } catch (err) {
        console.warn('[dbService] Supabase getEntries failed, falling back to IDB:', err);
      }
    }

    // Offline path — try IDB first, then LS
    const idbRows = await idbGetEntries(userId);
    if (idbRows.length > 0) return idbRows as unknown as Entry[];

    // Legacy localStorage fallback
    const entries = getLocalData<Entry[]>(LS_KEYS.ENTRIES, []);
    return entries
      .filter((e) => e.user_id === userId)
      .sort((a, b) => a.page_number - b.page_number);
  },

  async createEntry(entry: Omit<Entry, 'id' | 'created_at'>): Promise<Entry> {
    const newEntry: Entry = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // Always write to IDB immediately
    await idbPutEntry(newEntry as unknown as Record<string, unknown>);

    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('entries')
          .insert(newEntry)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[dbService] Supabase createEntry offline — queuing outbox:', err);
      }
    }

    if (supabase) {
      // Queue for later sync
      await outboxEnqueue({
        table: 'entries',
        operation: 'CREATE',
        payload: newEntry as unknown as Record<string, unknown>,
        userId: entry.user_id,
      });
    } else {
      // Pure mock mode — localStorage
      const entries = getLocalData<Entry[]>(LS_KEYS.ENTRIES, []);
      entries.push(newEntry);
      setLocalData(LS_KEYS.ENTRIES, entries);
    }

    return newEntry;
  },

  async updateEntry(userId: string, entryId: string, updates: Partial<Entry>): Promise<Entry> {
    // Read current from IDB / LS
    const idbRows = await idbGetEntries(userId);
    const existing = (idbRows as unknown as Entry[]).find((e) => e.id === entryId)
      ?? getLocalData<Entry[]>(LS_KEYS.ENTRIES, []).find(
           (e) => e.id === entryId && e.user_id === userId
         );

    if (!existing && !supabase) throw new Error('Entry not found');

    const merged: Entry = { ...(existing ?? ({} as Entry)), ...updates } as Entry;

    // Write to IDB immediately
    await idbPutEntry(merged as unknown as Record<string, unknown>);

    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('entries')
          .update(updates)
          .eq('id', entryId)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[dbService] Supabase updateEntry offline — queuing outbox:', err);
      }
    }

    if (supabase) {
      await outboxEnqueue({
        table: 'entries',
        operation: 'UPDATE',
        payload: { id: entryId, ...updates } as Record<string, unknown>,
        userId,
      });
    } else {
      const entries = getLocalData<Entry[]>(LS_KEYS.ENTRIES, []);
      const index = entries.findIndex((e) => e.id === entryId && e.user_id === userId);
      if (index === -1) throw new Error('Entry not found');
      entries[index] = merged;
      setLocalData(LS_KEYS.ENTRIES, entries);
    }

    return merged;
  },

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    // Remove from IDB immediately
    await idbDeleteEntry(entryId);

    if (supabase && navigator.onLine) {
      try {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', entryId)
          .eq('user_id', userId);
        if (error) throw error;
        return;
      } catch (err) {
        console.warn('[dbService] Supabase deleteEntry offline — queuing outbox:', err);
      }
    }

    if (supabase) {
      await outboxEnqueue({
        table: 'entries',
        operation: 'DELETE',
        payload: { id: entryId },
        userId,
      });
    } else {
      const entries = getLocalData<Entry[]>(LS_KEYS.ENTRIES, []);
      const filtered = entries.filter((e) => !(e.id === entryId && e.user_id === userId));
      setLocalData(LS_KEYS.ENTRIES, filtered);
    }
  },

  // --- ACTIVITY LOGS ---
  async getActivityLogs(userId?: string): Promise<ActivityLog[]> {
    if (supabase) {
      let query = supabase.from('activity_logs').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      // Load usernames for admin viewing
      const logs = data || [];
      if (!userId && logs.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username');
        const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);
        return logs.map(log => ({
          ...log,
          username: profileMap.get(log.user_id) || 'Unknown User'
        }));
      }
      return logs;
    } else {
      const logs = getLocalData<ActivityLog[]>(LS_KEYS.LOGS, []);
      const filtered = userId ? logs.filter((l) => l.user_id === userId) : logs;
      
      // Load usernames
      const profiles = getLocalData<Profile[]>(LS_KEYS.PROFILES, []);
      const profileMap = new Map(profiles.map(p => [p.id, p.username]));
      return filtered
        .map(log => ({
          ...log,
          username: profileMap.get(log.user_id) || 'Unknown User'
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async createActivityLog(userId: string, action: string): Promise<void> {
    const newLog: ActivityLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      action: action,
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      const { error } = await supabase
        .from('activity_logs')
        .insert(newLog);
      if (error) console.error('Failed to log activity to Supabase:', error);
    } else {
      const logs = getLocalData<ActivityLog[]>(LS_KEYS.LOGS, []);
      logs.push(newLog);
      setLocalData(LS_KEYS.LOGS, logs);
    }
  },

  async uploadAttachment(userId: string, attachmentId: string, encryptedJson: string): Promise<string> {
    const filename = `${userId}/${attachmentId}.json`;
    if (supabase) {
      try {
        const blob = new Blob([encryptedJson], { type: 'application/json' });
        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(filename, blob, { contentType: 'application/json', upsert: true });
        if (error) {
          if (error.message?.includes('bucket') || error.message?.includes('not found')) {
            console.warn('attachments bucket not found, falling back to localStorage');
            throw new Error('FALLBACK_TO_LOCAL');
          }
          throw error;
        }
        return data.path;
      } catch (err: any) {
        if (err.message !== 'FALLBACK_TO_LOCAL') {
          throw err;
        }
      }
    }
    
    // LocalStorage mock
    const attachments = getLocalData<Record<string, string>>('dreamvault_attachments', {});
    attachments[`${userId}_${attachmentId}`] = encryptedJson;
    setLocalData('dreamvault_attachments', attachments);
    return filename;
  },

  async downloadAttachment(userId: string, attachmentId: string): Promise<string> {
    const filename = `${userId}/${attachmentId}.json`;
    
    // Check local storage fallback first
    const attachments = getLocalData<Record<string, string>>('dreamvault_attachments', {});
    const localData = attachments[`${userId}_${attachmentId}`];
    if (localData) {
      return localData;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('attachments')
          .download(filename);
        if (error) throw error;
        return await data.text();
      } catch (err) {
        console.error('Supabase download failed for attachment:', err);
      }
    }
    
    throw new Error('Attachment not found');
  },

  async deleteAttachment(userId: string, attachmentId: string): Promise<void> {
    const filename = `${userId}/${attachmentId}.json`;
    
    // Clean local fallback
    const attachments = getLocalData<Record<string, string>>('dreamvault_attachments', {});
    if (attachments[`${userId}_${attachmentId}`]) {
      delete attachments[`${userId}_${attachmentId}`];
      setLocalData('dreamvault_attachments', attachments);
    }

    if (supabase) {
      try {
        await supabase.storage
          .from('attachments')
          .remove([filename]);
      } catch (err) {
        console.error('Supabase delete failed for attachment:', err);
      }
    }
  }
};
