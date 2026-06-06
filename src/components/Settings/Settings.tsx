import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDiary } from '../../context/DiaryContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeType } from '../../context/ThemeContext';
import { dbService, isSupabaseConfigured, supabase } from '../../services/dbService';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarUploader } from '../AvatarUploader/AvatarUploader';
import {
  User,
  Lock,
  Key,
  Sun,
  Type,
  FileText,
  Upload,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  AlertTriangle,
} from 'lucide-react';


export const Settings: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme, isHandwritten, setIsHandwritten } = useTheme();
  const { exportDiary, importDiary, changeDiaryLockPassword, hasSecuritySetup } = useDiary();

  // Accordion open states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
    security: false,
    appearance: false,
    backup: false,
    danger: false,
  });

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Profile ──────────────────────────────────────────────
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(user?.full_name || '');
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [profileMsg, setProfileMsg] = useState({ text: '', error: false });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg({ text: '', error: false });
    if (!usernameInput.trim()) {
      setProfileMsg({ text: 'Username cannot be blank', error: true });
      return;
    }
    try {
      await updateProfile({ full_name: fullNameInput, username: usernameInput, avatar_url: user?.avatar_url ?? null });
      setProfileMsg({ text: 'Profile saved successfully!', error: false });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileMsg({ text: err.message || 'Failed to save profile', error: true });
    }
  };

  // ── Account Password ──────────────────────────────────────
  const [currentAccPass, setCurrentAccPass] = useState('');
  const [newAccPass, setNewAccPass] = useState('');
  const [confirmAccPass, setConfirmAccPass] = useState('');
  const [accPassMsg, setAccPassMsg] = useState({ text: '', error: false });

  const handleAccountPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccPassMsg({ text: '', error: false });
    if (!currentAccPass || !newAccPass || !confirmAccPass) {
      setAccPassMsg({ text: 'Please fill all fields', error: true });
      return;
    }
    if (newAccPass !== confirmAccPass) {
      setAccPassMsg({ text: 'New passwords do not match', error: true });
      return;
    }
    if (newAccPass.length < 6) {
      setAccPassMsg({ text: 'Password must be at least 6 characters', error: true });
      return;
    }
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({ password: newAccPass });
        if (error) throw error;
      } else {
        const users = JSON.parse(localStorage.getItem('dreamvault_mock_auth_users') || '[]');
        const index = users.findIndex((u: any) => u.id === user?.id);
        if (index === -1) { setAccPassMsg({ text: 'User not found', error: true }); return; }
        if (users[index].password !== currentAccPass) { setAccPassMsg({ text: 'Current password is incorrect', error: true }); return; }
        users[index].password = newAccPass;
        localStorage.setItem('dreamvault_mock_auth_users', JSON.stringify(users));
      }
      if (user) await dbService.createActivityLog(user.id, 'Changed account password');
      setAccPassMsg({ text: 'Account password updated!', error: false });
      setCurrentAccPass(''); setNewAccPass(''); setConfirmAccPass('');
    } catch (err: any) {
      setAccPassMsg({ text: err.message || 'Failed to update password', error: true });
    }
  };

  // ── Diary Lock Password ───────────────────────────────────
  const [oldLockPass, setOldLockPass] = useState('');
  const [newLockPass, setNewLockPass] = useState('');
  const [confirmLockPass, setConfirmLockPass] = useState('');
  const [lockPassMsg, setLockPassMsg] = useState({ text: '', error: false });

  const handleDiaryLockPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLockPassMsg({ text: '', error: false });
    if (!oldLockPass || !newLockPass || !confirmLockPass) {
      setLockPassMsg({ text: 'Please fill all fields', error: true });
      return;
    }
    if (newLockPass.length < 4) {
      setLockPassMsg({ text: 'New password must be at least 4 characters', error: true });
      return;
    }
    if (newLockPass !== confirmLockPass) {
      setLockPassMsg({ text: 'New passwords do not match', error: true });
      return;
    }
    try {
      await changeDiaryLockPassword(oldLockPass, newLockPass);
      setLockPassMsg({ text: 'Diary lock password updated!', error: false });
      setOldLockPass(''); setNewLockPass(''); setConfirmLockPass('');
    } catch (err: any) {
      setLockPassMsg({ text: err.message || 'Failed to update lock password', error: true });
    }
  };

  // ── Appearance ────────────────────────────────────────────
  const themesList: { id: ThemeType; label: string; desc: string; preview: string }[] = [
    { id: 'classic',  label: 'Classic Diary', desc: 'Warm ivory paper with brown leather finish.', preview: 'bg-[#fcfaf2] border-amber-800 border-2' },
    { id: 'dark',     label: 'Dark Mode',      desc: 'Sleek high-contrast deep-space palette.',    preview: 'bg-[#1c212c] border-[#a855f7] border-2' },
    { id: 'vintage',  label: 'Vintage Journal',desc: 'Aged mahogany and gold sepia bindings.',     preview: 'bg-[#f0e6cb] border-[#800000] border-2' },
    { id: 'dream',    label: 'Dream Theme',    desc: 'Cosmic violet gradients and nebula dust.',   preview: 'bg-[#281e59] border-[#ec4899] border-2' },
    { id: 'minimal',  label: 'Minimal',        desc: 'Clean white grid with crisp borders.',       preview: 'bg-white border-black border-2' },
  ];

  // ── Export / Import ───────────────────────────────────────
  const [importJson, setImportJson] = useState('');
  const [importMsg, setImportMsg] = useState({ text: '', error: false });
  const [isImporting, setIsImporting] = useState(false);

  const handleJsonImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportMsg({ text: '', error: false });
    if (!importJson.trim()) return;
    setIsImporting(true);
    try {
      await importDiary(importJson);
      setImportMsg({ text: 'Entries imported successfully!', error: false });
      setImportJson('');
    } catch (err: any) {
      setImportMsg({ text: err.message || 'Failed to import data', error: true });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Danger Zone ───────────────────────────────────────────
  const handleWipeDiary = async () => {
    const confirmed = window.confirm('DANGER: Delete all diary entries? Your account and settings will be preserved.');
    if (!confirmed) return;
    try {
      if (isSupabaseConfigured && supabase && user) {
        const { error } = await supabase.from('entries').delete().eq('user_id', user.id);
        if (error) throw error;
      } else {
        localStorage.setItem('dreamvault_entries', JSON.stringify([]));
      }
      alert('All diary entries have been cleared.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to clear entries');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const c1 = window.confirm('WARNING: Permanently delete your DreamVault account? This cannot be undone.');
    if (!c1) return;
    const c2 = window.confirm('Final confirmation — all your entries and account data will be deleted permanently.');
    if (!c2) return;
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('entries').delete().eq('user_id', user.id);
        await supabase.from('diaries').delete().eq('user_id', user.id);
        await supabase.from('diary_security').delete().eq('user_id', user.id);
        alert('Account data deleted. Contact your administrator to remove the auth record.');
        logout();
      } else {
        ['dreamvault_profiles', 'dreamvault_entries', 'dreamvault_security', 'dreamvault_mock_auth_users'].forEach(key => {
          const items = JSON.parse(localStorage.getItem(key) || '[]');
          const filtered = items.filter((i: any) => i.id !== user.id && i.user_id !== user.id);
          localStorage.setItem(key, JSON.stringify(filtered));
        });
        alert('Account deleted.');
        logout();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  // ── Shared UI helpers ─────────────────────────────────────
  const SectionHeader = ({ id, icon, label, danger = false }: { id: string; icon: React.ReactNode; label: string; danger?: boolean }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className={`w-full flex items-center justify-between p-4 md:p-5 text-left font-bold text-sm transition cursor-pointer min-h-[44px]
        ${danger
          ? 'text-red-600 hover:bg-red-500/10'
          : 'text-[var(--color-text)] hover:bg-[var(--bg-paper-back)]/50'
        }`}
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      {expandedSections[id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  const Msg = ({ msg }: { msg: { text: string; error: boolean } }) =>
    msg.text ? (
      <div className={`text-xs font-semibold p-2.5 rounded-xl border ${
        msg.error ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'
      }`}>{msg.text}</div>
    ) : null;

  const Toggle = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer flex-shrink-0
        ${active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-lines)]'}`}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200
        ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );

  const inputCls = "w-full p-2.5 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] text-xs text-[var(--color-text)] rounded-xl focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 min-h-[44px] transition";
  const labelCls = "block text-[10px] text-[var(--color-text-muted)] font-semibold mb-1 uppercase tracking-wide";
  const btnPrimary = "px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]";
  const btnSecondary = "px-4 py-2.5 border border-[var(--color-lines)] text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-20 select-none">

      {/* ═══════════════════════ 1. PROFILE ═══════════════════════ */}
      <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
        <SectionHeader id="profile" icon={<User className="w-5 h-5 text-[var(--color-accent)]" />} label="Profile" />
        <AnimatePresence initial={false}>
          {expandedSections.profile && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="p-4 md:p-6 border-t border-[var(--color-lines)] space-y-5">
                <Msg msg={profileMsg} />

                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Avatar uploader */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <AvatarUploader size={80} />
                    <p className="text-[9px] text-[var(--color-text-muted)] text-center leading-tight">
                      Click avatar to<br />upload a photo
                    </p>
                  </div>

                  <div className="flex-1 w-full">
                    {isEditingProfile ? (
                      <form onSubmit={handleProfileSave} className="space-y-3">
                        <div>
                          <label className={labelCls}>Full Name</label>
                          <input type="text" value={fullNameInput} onChange={e => setFullNameInput(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Username</label>
                          <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="submit" className={btnPrimary}>Save Changes</button>
                          <button type="button" onClick={() => { setIsEditingProfile(false); setFullNameInput(user?.full_name || ''); setUsernameInput(user?.username || ''); }} className={btnSecondary}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <p className={labelCls}>Full Name</p>
                            <p className="font-bold text-[var(--color-text)]">{user?.full_name || '—'}</p>
                          </div>
                          <div>
                            <p className={labelCls}>Username</p>
                            <p className="font-bold text-[var(--color-text)]">@{user?.username}</p>
                          </div>
                          <div className="col-span-2">
                            <p className={labelCls}>Email</p>
                            <p className="font-bold text-[var(--color-text)] truncate">
                              {user?.id === 'mock-admin' ? 'admin@dreamvault.local' : (user as any)?.email || 'authenticated@dreamvault.local'}
                            </p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setIsEditingProfile(true)} className={btnSecondary}>Edit Profile</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════ 2. SECURITY ═══════════════════════ */}
      <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
        <SectionHeader id="security" icon={<Lock className="w-5 h-5 text-[var(--color-accent)]" />} label="Account & Security" />
        <AnimatePresence initial={false}>
          {expandedSections.security && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="p-4 md:p-6 border-t border-[var(--color-lines)] space-y-6">

                {/* Change Account Password */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-[var(--color-accent)]" /> Change Account Password
                  </h4>
                  <Msg msg={accPassMsg} />
                  <form onSubmit={handleAccountPasswordChange} className="space-y-3">
                    <div>
                      <label className={labelCls}>Current Password</label>
                      <input type="password" value={currentAccPass} onChange={e => setCurrentAccPass(e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>New Password</label>
                        <input type="password" value={newAccPass} onChange={e => setNewAccPass(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Confirm New Password</label>
                        <input type="password" value={confirmAccPass} onChange={e => setConfirmAccPass(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <button type="submit" className={btnPrimary}>Update Password</button>
                  </form>
                </div>

                {/* Change Diary Lock Password */}
                {hasSecuritySetup && (
                  <div className="space-y-3 pt-5 border-t border-[var(--color-lines)]">
                    <h4 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[var(--color-accent)]" /> Change Diary Lock Password
                    </h4>
                    <Msg msg={lockPassMsg} />
                    <form onSubmit={handleDiaryLockPasswordChange} className="space-y-3">
                      <div>
                        <label className={labelCls}>Current Lock Password</label>
                        <input type="password" value={oldLockPass} onChange={e => setOldLockPass(e.target.value)} className={inputCls} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>New Lock Password</label>
                          <input type="password" value={newLockPass} onChange={e => setNewLockPass(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Confirm New Password</label>
                          <input type="password" value={confirmLockPass} onChange={e => setConfirmLockPass(e.target.value)} className={inputCls} />
                        </div>
                      </div>
                      <button type="submit" className={btnPrimary}>Update Lock Password</button>
                    </form>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════ 3. APPEARANCE ═══════════════════════ */}
      <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
        <SectionHeader id="appearance" icon={<Sun className="w-5 h-5 text-[var(--color-accent)]" />} label="Appearance" />
        <AnimatePresence initial={false}>
          {expandedSections.appearance && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="p-4 md:p-6 border-t border-[var(--color-lines)] space-y-5">

                {/* Handwriting Toggle */}
                <div className="flex items-center justify-between bg-[var(--bg-paper-back)] p-3.5 rounded-xl border border-[var(--color-lines)]">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-[var(--color-accent)]" />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-text)]">Handwritten Font</h4>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Render journal entries in a natural cursive style.</p>
                    </div>
                  </div>
                  <Toggle active={isHandwritten} onToggle={() => setIsHandwritten(!isHandwritten)} />
                </div>

                {/* Theme Grid */}
                <div>
                  <p className={labelCls + ' mb-3'}>Choose Theme</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {themesList.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition shadow-sm cursor-pointer
                          ${theme === t.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-lines)] hover:bg-[var(--bg-paper-back)]'
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${t.preview}`}>
                          {theme === t.id && <Check className="w-4 h-4 text-[var(--color-accent)]" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[var(--color-text)]">{t.label}</h4>
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-snug">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════ 4. BACKUP & EXPORT ═══════════════════════ */}
      <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
        <SectionHeader id="backup" icon={<FileText className="w-5 h-5 text-[var(--color-accent)]" />} label="Export & Import" />
        <AnimatePresence initial={false}>
          {expandedSections.backup && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="p-4 md:p-6 border-t border-[var(--color-lines)] space-y-6">

                {/* Export */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--color-text)] mb-1">Export Diary</h4>
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Download all your entries in your preferred format.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pdf', 'txt', 'json'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => exportDiary(fmt)}
                        className="py-2.5 text-xs font-bold rounded-xl border border-[var(--color-lines)] bg-[var(--bg-paper-back)] text-[var(--color-text)] hover:bg-[var(--bg-paper-back)]/80 hover:border-[var(--color-accent)] transition cursor-pointer min-h-[44px] uppercase tracking-wide"
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import */}
                <div className="pt-4 border-t border-[var(--color-lines)]">
                  <h4 className="text-xs font-bold text-[var(--color-text)] mb-1">Import JSON Backup</h4>
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Paste a previously exported JSON to restore entries.</p>
                  <Msg msg={importMsg} />
                  <form onSubmit={handleJsonImport} className="space-y-3 mt-2">
                    <textarea
                      value={importJson}
                      onChange={e => setImportJson(e.target.value)}
                      placeholder='[{"title":"My Entry","content":"Hello diary","mood":"happy"}]'
                      className="w-full h-20 text-xs p-2.5 rounded-xl bg-[var(--bg-paper-back)] border border-[var(--color-lines)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)] font-mono resize-none"
                    />
                    <button
                      type="submit"
                      disabled={isImporting || !importJson.trim()}
                      className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isImporting ? 'Importing…' : 'Restore from JSON'}
                    </button>
                  </form>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════ 5. DANGER ZONE ═══════════════════════ */}
      <div className="bg-red-500/5 rounded-2xl border border-red-500/20 shadow-sm overflow-hidden">
        <SectionHeader id="danger" icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Danger Zone" danger />
        <AnimatePresence initial={false}>
          {expandedSections.danger && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="p-4 md:p-6 border-t border-red-500/20 space-y-4">

                {/* Sign Out */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-paper)] p-4 rounded-xl border border-[var(--color-lines)]">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text)]">Sign Out</h4>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Log out of your current session.</p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-500 hover:bg-stone-600 text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>

                {/* Wipe Diary */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-paper)] p-4 rounded-xl border border-[var(--color-lines)]">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text)]">Wipe All Entries</h4>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Delete all diary entries while keeping your account.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleWipeDiary}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Entries
                  </button>
                </div>

                {/* Delete Account */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-paper)] p-4 rounded-xl border border-red-500/25">
                  <div>
                    <h4 className="text-xs font-bold text-red-600">Delete Account</h4>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Permanently erase all data and your account. Irreversible.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer min-h-[44px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Account
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
