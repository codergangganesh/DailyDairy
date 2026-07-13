  import React, { useState, useEffect } from 'react';
import { dbService, type Profile, type Entry, supabase, isSupabaseConfigured } from '../../services/dbService';
import {
  deriveKeyFromPassword,
  unwrapMasterKey,
  decryptWithKey,
  base64ToBytes,
} from '../../services/cryptoService';
import {
  X,
  BookOpen,
  Lock,
  Unlock,
  Calendar,
  BookmarkCheck,
  Sparkles,
  Edit3,
  Flame,
  Clock,
  Heart,
  RefreshCw,
  User,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Mood helpers ────────────────────────────────────────────────────────────
const MOOD_EMOJI: Record<string, string> = {
  happy: '😀',
  calm: '😌',
  sad: '😢',
  angry: '😡',
  tired: '😴',
  excited: '🤩',
};

const MOOD_COLOR: Record<string, string> = {
  happy: 'bg-yellow-400/10 text-yellow-600 border-yellow-400/30',
  calm: 'bg-green-400/10 text-green-600 border-green-400/30',
  sad: 'bg-blue-400/10 text-blue-600 border-blue-400/30',
  angry: 'bg-red-400/10 text-red-600 border-red-400/30',
  tired: 'bg-purple-400/10 text-purple-600 border-purple-400/30',
  excited: 'bg-orange-400/10 text-orange-600 border-orange-400/30',
};

// ── Category icon helper ────────────────────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  const cls = 'w-3.5 h-3.5';
  switch (category) {
    case 'Daily Journal':   return <Calendar className={cls} />;
    case 'Dream Journal':   return <Sparkles className={`${cls} text-purple-500`} />;
    case 'Personal Notes':  return <Edit3 className={cls} />;
    case 'Goals':           return <Flame className={`${cls} text-orange-500`} />;
    case 'Memories':        return <Clock className={cls} />;
    case 'Gratitude':       return <Heart className={`${cls} text-red-500 fill-red-500`} />;
    default:                return <BookOpen className={cls} />;
  }
}

// ── Category badge colour helper ───────────────────────────────────────────
function categoryBadge(category: string): string {
  const map: Record<string, string> = {
    'Daily Journal':  'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'Dream Journal':  'bg-purple-500/10 text-purple-600 border-purple-500/20',
    'Personal Notes': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    'Goals':          'bg-orange-500/10 text-orange-600 border-orange-500/20',
    'Memories':       'bg-teal-500/10 text-teal-600 border-teal-500/20',
    'Gratitude':      'bg-pink-500/10 text-pink-600 border-pink-500/20',
  };
  return map[category] ?? 'bg-[var(--bg-paper-back)] text-[var(--color-text-muted)] border-[var(--color-lines)]';
}

// ── Decrypted entry content shape ───────────────────────────────────────────
interface DecryptedContent {
  title?: string;
  content?: string;
  tags?: string[];
}

interface Props {
  user: Profile;
  onClose: () => void;
}

export const UserDiaryViewer: React.FC<Props> = ({ user, onClose }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryCount, setEntryCount] = useState<number | null>(null);

  // Decryption state
  const [diaryPassword, setDiaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedContent>>({});
  const [hasAdminOverride, setHasAdminOverride] = useState<boolean | null>(null); // null = unknown

  const loadEntries = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .order('page_number', { ascending: true });

        if (error) throw error;
        setEntries((data ?? []) as unknown as Entry[]);
        setEntryCount((data ?? []).length);
      } else {
        // LocalStorage mock mode
        const raw = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]') as Entry[];
        const userEntries = raw
          .filter(e => e.user_id === user.id)
          .sort((a, b) => a.page_number - b.page_number);

        setEntries(userEntries);
        setEntryCount(userEntries.length);
      }
    } catch (err) {
      console.error('Failed to load diary entries for admin view:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [user.id]);

  // ── Check if admin override key is available ──────────────────────
  const decryptEntries = async (masterKey: CryptoKey, fullEntries: Entry[]) => {
    setEntries(fullEntries);
    setEntryCount(fullEntries.length);
    const decrypted: Record<string, DecryptedContent> = {};
    for (const entry of fullEntries) {
      if (entry.encrypted_content && entry.iv) {
        try {
          const plaintext = await decryptWithKey(entry.encrypted_content, masterKey, entry.iv);
          const parsed = JSON.parse(plaintext) as DecryptedContent;
          decrypted[entry.id] = parsed;
        } catch {
          decrypted[entry.id] = { title: '[Decryption failed]', content: 'Could not decrypt this entry.', tags: [] };
        }
      }
    }
    setDecryptedMap(decrypted);
    setIsUnlocked(true);
  };

  const fetchFullEntries = async (): Promise<Entry[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .order('page_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    } else {
      const raw = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]') as Entry[];
      return raw
        .filter(e => e.user_id === user.id)
        .sort((a, b) => a.page_number - b.page_number);
    }
  };

  // ── Admin Override: one-click decrypt using VITE_ADMIN_OVERRIDE_KEY ──
  const handleAdminUnlock = async () => {
    const adminOverrideKey = import.meta.env.VITE_ADMIN_OVERRIDE_KEY as string | undefined;
    if (!adminOverrideKey || adminOverrideKey.length === 0) {
      setUnlockError('Admin override key is not configured in .env (VITE_ADMIN_OVERRIDE_KEY).');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');

    try {
      const security = await dbService.getDiarySecurity(user.id);
      if (!security) {
        setUnlockError('No diary lock found for this user.');
        setIsUnlocking(false);
        return;
      }

      if (!security.admin_encrypted_master_key || !security.admin_master_key_iv || !security.admin_master_key_salt) {
        setUnlockError('This user set up their diary before admin override was configured. Use their diary password below instead, or have them re-lock their diary to enable admin access.');
        setHasAdminOverride(false);
        setIsUnlocking(false);
        return;
      }

      // Derive admin key and unwrap master key
      const adminSaltBytes = base64ToBytes(security.admin_master_key_salt);
      const adminDerivedKey = await deriveKeyFromPassword(adminOverrideKey, adminSaltBytes, 100000);
      const masterKey = await unwrapMasterKey(
        security.admin_encrypted_master_key,
        adminDerivedKey,
        security.admin_master_key_iv
      );

      const fullEntries = await fetchFullEntries();
      await decryptEntries(masterKey, fullEntries);
    } catch (err: any) {
      setUnlockError('Admin override decryption failed. The admin key may have changed since this user set up their diary.');
      console.error('Admin unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  // ── Unlock diary with password ──────────────────────────────────────────
  const handleUnlock = async () => {
    if (!diaryPassword.trim()) {
      setUnlockError('Please enter the diary password.');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');

    try {
      // 1. Fetch the diary_security record for this user
      const security = await dbService.getDiarySecurity(user.id);
      if (!security) {
        setUnlockError('No diary lock found for this user. They may not have set a diary password yet.');
        setIsUnlocking(false);
        return;
      }

      // 2. Derive the key from the diary password using stored salt
      const saltBytes = new Uint8Array(
        atob(security.master_key_salt)
          .split('')
          .map(c => c.charCodeAt(0))
      );
      const derivedKey = await deriveKeyFromPassword(diaryPassword, saltBytes, 100000);

      // 3. Unwrap the master key
      const masterKey = await unwrapMasterKey(
        security.encrypted_master_key,
        derivedKey,
        security.master_key_iv
      );

      // 4. Re-fetch entries with full encrypted content
      let fullEntries: Entry[];
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .order('page_number', { ascending: true });
        if (error) throw error;
        fullEntries = (data ?? []) as unknown as Entry[];
      } else {
        const raw = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]') as Entry[];
        fullEntries = raw
          .filter(e => e.user_id === user.id)
          .sort((a, b) => a.page_number - b.page_number);
      }

      setEntries(fullEntries);
      setEntryCount(fullEntries.length);

      // 5. Decrypt each entry
      const decrypted: Record<string, DecryptedContent> = {};
      for (const entry of fullEntries) {
        if (entry.encrypted_content && entry.iv) {
          try {
            const plaintext = await decryptWithKey(entry.encrypted_content, masterKey, entry.iv);
            const parsed = JSON.parse(plaintext) as DecryptedContent;
            decrypted[entry.id] = parsed;
          } catch {
            decrypted[entry.id] = { title: '[Decryption failed]', content: 'Could not decrypt this entry.', tags: [] };
          }
        }
      }

      setDecryptedMap(decrypted);
      setIsUnlocked(true);
    } catch (err: any) {
      setUnlockError('Wrong diary password or decryption failed. Please try again.');
      console.error('Unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setDecryptedMap({});
    setDiaryPassword('');
    setUnlockError('');
  };

  // Avatar src
  const avatarSrc =
    user.avatar_url?.startsWith('data:') || user.avatar_url?.startsWith('http')
      ? user.avatar_url
      : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

  return (
    // Backdrop
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Side panel */}
      <motion.div
        className="relative w-full max-w-md h-full bg-[var(--bg-paper)] border-l border-[var(--color-lines)] shadow-2xl flex flex-col overflow-hidden"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--color-lines)] bg-[var(--bg-paper-back)]/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={avatarSrc}
              alt="avatar"
              className="w-11 h-11 rounded-full border-2 border-[var(--color-accent)] object-cover shrink-0 bg-[var(--bg-paper-back)]"
            />
            <div className="min-w-0">
              <p className="font-bold text-sm text-[var(--color-text)] truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">@{user.username}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                  user.role === 'admin'
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                    : 'bg-[var(--bg-paper-back)] text-[var(--color-text-muted)] border-[var(--color-lines)]'
                }`}>
                  {user.role.toUpperCase()}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                  user.suspended
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-green-500/10 text-green-500 border-green-500/20'
                }`}>
                  {user.suspended ? 'SUSPENDED' : 'ACTIVE'}
                </span>
                {entryCount !== null && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-blue-500/10 text-blue-600 border-blue-500/20">
                    {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                  </span>
                )}
                {isUnlocked && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-0.5">
                    <Unlock className="w-2.5 h-2.5" />
                    UNLOCKED
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={loadEntries}
              disabled={loading}
              title="Refresh"
              className="p-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:bg-[var(--bg-paper)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-500 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Unlock / Lock section ──────────────────────────────── */}
        <div className="mx-4 mt-4 mb-2 shrink-0 space-y-2">
          {!isUnlocked ? (
            <>
              {/* Password input */}
              <div className="p-3 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span className="text-[11px] font-bold text-[var(--color-text)]">Unlock Diary Content</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                  Enter the user's <span className="font-semibold">diary password</span> to decrypt and read their entries.
                  The decryption happens entirely client-side.
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={diaryPassword}
                    onChange={e => { setDiaryPassword(e.target.value); setUnlockError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                    placeholder="User's diary password…"
                    className="w-full pl-3 pr-9 py-2 bg-[var(--bg-paper)] border border-[var(--color-lines)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={handleUnlock}
                  disabled={isUnlocking || !diaryPassword.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {isUnlocking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Decrypting…
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Unlock & Read Entries
                    </>
                  )}
                </button>
                {unlockError && (
                  <div className="flex items-start gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">{unlockError}</p>
                  </div>
                )}
              </div>

              {/* Privacy notice when locked */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Diary content is <span className="font-bold">end-to-end encrypted</span> with the user's diary password.
                  Enter their password above to decrypt and read entries.
                </p>
              </div>
            </>
          ) : (
            /* Locked state — show lock button */
            <div className="flex items-center justify-between p-3 bg-green-500/8 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Unlock className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <p className="text-[11px] text-green-700 dark:text-green-400 font-semibold">
                  Diary unlocked — {entryCount} {entryCount === 1 ? 'entry' : 'entries'} decrypted
                </p>
              </div>
              <button
                onClick={handleLock}
                title="Lock diary"
                className="p-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 transition cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── User joined info ───────────────────────────────────── */}
        <div className="mx-4 mb-3 flex items-center gap-2 p-3 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl shrink-0">
          <User className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Joined <span className="font-semibold text-[var(--color-text)]">{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            &nbsp;·&nbsp;ID: <span className="font-mono text-[10px]">{user.id.substring(0, 12)}…</span>
          </p>
        </div>

        {/* ── Entry list ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">

          {/* Section heading */}
          <div className="flex items-center gap-1.5 py-1 border-b border-[var(--color-lines)] mb-1">
            <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {isUnlocked ? 'Diary Entries — Decrypted' : 'Diary Entries — Metadata Only'}
            </span>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
              <p className="text-xs text-[var(--color-text-muted)]">Loading entries…</p>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <BookOpen className="w-8 h-8 text-[var(--color-text-muted)]/30" />
              <p className="text-xs text-[var(--color-text-muted)]">This user has no diary entries yet.</p>
            </div>
          )}

          {!loading && entries.map(entry => {
            const decrypted = decryptedMap[entry.id];
            return (
              <div
                key={entry.id}
                className="group flex flex-col gap-2 p-3 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl hover:border-[var(--color-accent)]/40 transition-colors"
              >
                {/* Top row: page number + badges + date */}
                <div className="flex items-start gap-3">
                  {/* Page badge */}
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--bg-paper)] border border-[var(--color-lines)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-muted)]">
                    {entry.page_number}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {/* Category */}
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${categoryBadge(entry.category)}`}>
                        <CategoryIcon category={entry.category} />
                        {entry.category}
                      </span>

                      {/* Mood */}
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${MOOD_COLOR[entry.mood] ?? 'bg-[var(--bg-paper-back)] text-[var(--color-text-muted)] border-[var(--color-lines)]'}`}>
                        {MOOD_EMOJI[entry.mood] ?? '😐'} {entry.mood}
                      </span>

                      {/* Favorite */}
                      {entry.is_favorite && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <BookmarkCheck className="w-3 h-3 fill-amber-500 text-amber-500" />
                          Starred
                        </span>
                      )}
                    </div>

                    {/* Content area */}
                    {isUnlocked && decrypted ? (
                      <div className="space-y-1.5">
                        {/* Title */}
                        {decrypted.title && (
                          <p className="text-xs font-bold text-[var(--color-text)]">{decrypted.title}</p>
                        )}
                        {/* Content */}
                        {decrypted.content && (
                          <div className="text-[11px] text-[var(--color-text)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-1">
                            {decrypted.content}
                          </div>
                        )}
                        {/* Tags */}
                        {decrypted.tags && decrypted.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap pt-0.5">
                            {decrypted.tags.map(tag => (
                              <span key={tag} className="text-[8px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-1.5 py-0.5 rounded-full font-bold">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Encrypted placeholder */
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] italic">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>Content encrypted — unlock to read</span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]/70">
                      {new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer security note ───────────────────────────────── */}
        <div className="shrink-0 px-4 py-3 border-t border-[var(--color-lines)] bg-[var(--bg-paper-back)]/50">
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
            <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${isUnlocked ? 'text-green-500' : 'text-amber-500'}`} />
            {isUnlocked
              ? 'AES-256-GCM · Decrypted client-side · Admin read session active'
              : 'AES-256-GCM · Zero-knowledge · Enter diary password to decrypt'
            }
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
