import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDiary } from '../context/DiaryContext';
import { DiaryBook } from '../components/DiaryBook/DiaryBook';
import { CalendarView } from '../components/CalendarView/CalendarView';
import { MoodTracker } from '../components/MoodTracker/MoodTracker';
import { Settings } from '../components/Settings/Settings';
import { AvatarUploader, type AvatarUploaderHandle } from '../components/AvatarUploader/AvatarUploader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  Smile,
  Settings as SettingsIcon,
  LogOut,
  Feather,
  Camera,
  User,
  ChevronDown,
} from 'lucide-react';

export const JournalPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { isUnlocked } = useDiary();

  const [activeTab, setActiveTab] = useState<'diary' | 'calendar' | 'memories' | 'settings'>('diary');
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarUploaderRef = useRef<AvatarUploaderHandle>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems = [
    { id: 'diary',    label: 'Journal',  icon: BookOpen,     requiresUnlock: false },
    { id: 'calendar', label: 'Calendar', icon: Calendar,     requiresUnlock: true  },
    { id: 'memories', label: 'Mood',     icon: Smile,        requiresUnlock: true  },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, requiresUnlock: true  },
  ] as const;

  const visibleTabs = navItems.filter(tab => !tab.requiresUnlock || isUnlocked);

  // Determine avatar src
  const avatarUrl = user?.avatar_url;
  const isRealPhoto = avatarUrl?.startsWith('data:') || avatarUrl?.startsWith('http');
  const avatarSrc = isRealPhoto
    ? avatarUrl!
    : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarUrl || user?.username || 'user'}`;

  return (
    <div className="min-h-screen flex flex-col select-none bg-[var(--bg-app)] transition-colors duration-300">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="bg-[var(--bg-paper)] border-b border-[var(--color-lines)] px-4 py-2.5 sticky top-0 z-[100] shadow-sm transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-8 h-8 rounded-lg object-cover border border-amber-950/20 shadow-sm" alt="DreamVault Logo" />
            <div>
              <span className="font-serif font-bold text-sm text-[var(--color-text)] tracking-wider block">DreamVault</span>
              <span className="text-[8px] text-[var(--color-text-muted)] tracking-widest uppercase -mt-0.5 block">Secure Diary</span>
            </div>
          </div>

          {/* Desktop nav tabs */}
          <nav className="hidden md:flex gap-1.5">
            {navItems.map(tab => {
              const Icon = tab.icon;
              if (tab.requiresUnlock && !isUnlocked) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer
                    ${activeTab === tab.id
                      ? 'bg-[var(--color-accent)] text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] hover:text-[var(--color-text)]'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* ── Profile avatar dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(prev => !prev)}
              className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-[var(--bg-paper-back)] transition cursor-pointer group"
              aria-label="Profile menu"
            >
              {/* Avatar circle */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--color-accent)] shadow-sm flex-shrink-0">
                {isRealPhoto ? (
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover bg-[var(--bg-paper-back)] p-0.5" />
                )}
              </div>
              {/* Chevron — desktop only */}
              <ChevronDown
                className={`hidden md:block w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200
                  ${profileOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* ── Dropdown panel ── */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0,  scale: 1    }}
                  exit={{  opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-[calc(100%+8px)] w-64 bg-[var(--bg-paper)] border-2 border-[var(--color-lines)] border-t-4 border-t-[var(--color-bookmark)] rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  {/* User info card */}
                  <div className="flex items-center gap-3 p-4 border-b border-[var(--color-lines)] bg-[var(--bg-paper-back)]/50">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[var(--color-accent)] shadow">
                        {isRealPhoto ? (
                          <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover bg-[var(--bg-paper-back)] p-0.5" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--color-text)] truncate">
                        {user?.full_name || user?.username}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                        @{user?.username}
                      </p>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-2 space-y-0.5">

                    {/* Change photo — calls AvatarUploader.open() via ref */}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        // Small delay so dropdown closes before file picker opens
                        setTimeout(() => avatarUploaderRef.current?.open(), 100);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--bg-paper-back)] transition cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                        <Camera className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      </div>
                      Change Profile Photo
                    </button>

                    {/* Go to Settings */}
                    <button
                      onClick={() => { setActiveTab('settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--bg-paper-back)] transition cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      </div>
                      Profile & Settings
                    </button>

                    {/* Divider */}
                    <div className="my-1 border-t border-[var(--color-lines)]" />

                    {/* Sign Out */}
                    <button
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </header>

      {/* Trigger-only AvatarUploader — renders no UI, opened via ref from the dropdown */}
      <AvatarUploader ref={avatarUploaderRef} triggerOnly />

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-0 md:px-4 py-6 pb-28 md:pb-6">

        {!isUnlocked ? (
          <div className="px-4">
            <DiaryBook />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'diary'    && <DiaryBook />}
              {activeTab === 'calendar' && <div className="px-4"><CalendarView /></div>}
              {activeTab === 'memories' && <div className="px-4"><MoodTracker /></div>}
              {activeTab === 'settings' && <div className="px-4"><Settings /></div>}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV BAR ───────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[var(--bg-paper)] border-t border-[var(--color-lines)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-6 pt-2 pb-3">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center gap-1.5 cursor-pointer min-w-[56px]"
              >
                {/* Pill container */}
                <div className="relative flex items-center justify-center w-14 h-8">
                  {isActive && (
                    <motion.div
                      layoutId="mobileNavPill"
                      className="absolute inset-0 rounded-full bg-[var(--color-accent)]"
                      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 w-[18px] h-[18px] transition-colors duration-200
                      ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
                    strokeWidth={isActive ? 2.3 : 1.8}
                  />
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] leading-none font-semibold tracking-wide transition-colors duration-200
                    ${isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
                >
                  {tab.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ── DESKTOP FOOTER ──────────────────────────────────────────── */}
      <footer className="hidden md:block py-4 border-t border-[var(--color-lines)] text-center text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
        DreamVault © {new Date().getFullYear()} • Encrypted client-side with AES-256-GCM
      </footer>

    </div>
  );
};
