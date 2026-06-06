import React, { useState, useEffect, useRef } from 'react';
import { useDiary, type DecryptedEntry } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { RichEditor } from '../RichEditor/RichEditor';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Lock,
  Unlock,
  Key,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Search,
  Bookmark,
  BookmarkCheck,
  Plus,
  Edit3,
  HelpCircle,
  LogOut,
  Flame,
  Sparkles,
  ChevronDown,
  Check,
  Heart
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const DiaryBook: React.FC = () => {
  const { user, logout } = useAuth();
  const {

    isUnlocked,
    hasSecuritySetup,
    securityRecord,
    entries,
    stats,
    isLoadingDiary,
    lockUntil,
    activePage,
    setupSecurity,
    unlockDiary,
    lockDiary,
    recoverDiary,
    saveEntry,
    setActivePage,
    toggleFavorite
  } = useDiary();


  // Unlock and security states
  const [passwordInput, setPasswordInput] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('What was the name of your first pet?');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Account Recovery State
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverAnswerInput, setRecoverAnswerInput] = useState('');
  const [recoverNewPassword, setRecoverNewPassword] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'All' | 'Daily Journal' | 'Dream Journal' | 'Personal Notes' | 'Goals' | 'Memories' | 'Gratitude' | 'Starred'>('All');
  
  // Mobile Dropdown State & Ref
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'All':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'Daily Journal':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'Dream Journal':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'Personal Notes':
        return <Edit3 className="w-3.5 h-3.5" />;
      case 'Goals':
        return <Flame className="w-3.5 h-3.5" />;
      case 'Memories':
        return <Clock className="w-3.5 h-3.5" />;
      case 'Gratitude':
        return <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
      case 'Starred':
      default:
        return <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />;
    }
  };
  
  // Date-Time Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtered entries for pagination/bookmark tabs
  const getFilteredEntries = () => {
    let result = [...entries];
    
    // Category tab filter
    if (selectedCategoryTab === 'Starred') {
      result = result.filter(e => e.is_favorite);
    } else if (selectedCategoryTab !== 'All') {
      result = result.filter(e => e.category === selectedCategoryTab);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          e.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return result;
  };

  const filteredEntries = getFilteredEntries();
  const activeEntry: DecryptedEntry | undefined = filteredEntries[activePage - 1];

  // Adjust active page if entries list changes (e.g. filters)
  useEffect(() => {
    if (filteredEntries.length > 0 && activePage > filteredEntries.length) {
      setActivePage(filteredEntries.length);
    }
  }, [filteredEntries.length, activePage, setActivePage]);

  // Handle Unlock Action
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passwordInput) return;
    
    const success = await unlockDiary(passwordInput);
    if (!success) {
      setPasswordInput('');
      setErrorMsg('Incorrect Password. Please try again.');
    } else {
      setPasswordInput('');
      // Fire confetti for satisfying open!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

  // Handle Security Setup Action
  const handleSetupSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (setupPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!recoveryAnswer.trim()) {
      setErrorMsg('Please provide a recovery answer.');
      return;
    }

    try {
      await setupSecurity(setupPassword, recoveryQuestion, recoveryAnswer);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to setup security lock');
    }
  };

  // Handle Recovery Action
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!recoverAnswerInput.trim()) {
      setErrorMsg('Please enter your recovery answer.');
      return;
    }
    if (recoverNewPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    const success = await recoverDiary(recoverAnswerInput, recoverNewPassword);
    if (success) {
      setIsRecovering(false);
      setRecoverAnswerInput('');
      setRecoverNewPassword('');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }
      });
    } else {
      setErrorMsg('Verification failed. Incorrect recovery answer.');
    }
  };

  // Log today's quick mood selection
  const handleQuickMoodSelect = async (selectedMood: DecryptedEntry['mood']) => {
    if (!user) return;
    try {
      // Find today's entry if exists to update, or save a micro-entry
      const todayStr = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find(
        e => new Date(e.created_at).toISOString().split('T')[0] === todayStr
      );

      if (todayEntry) {
        await saveEntry({
          id: todayEntry.id,
          title: todayEntry.title,
          content: todayEntry.content,
          tags: todayEntry.tags,
          mood: selectedMood,
          category: todayEntry.category,
          is_favorite: todayEntry.is_favorite,
        });
      } else {
        await saveEntry({
          title: 'Daily Mood Log',
          content: `Logging my mood today: ${selectedMood}.`,
          tags: ['mood', 'daily'],
          mood: selectedMood,
          category: 'Daily Journal',
          is_favorite: false
        });
      }
      confetti({
        particleCount: 30,
        spread: 40,
        origin: { x: 0.2, y: 0.7 }
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Date Formatting Helpers
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateLong = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] py-2 md:py-6 px-0 md:px-4 w-full">
      {/* ----------------- DIARY LOCKED STATE ----------------- */}
      {!isUnlocked && (
        <div className="w-full max-w-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--bg-cover)] border-4 border-[var(--bg-cover-border)] rounded-3xl p-8 shadow-[var(--shadow-book)] text-white relative overflow-hidden"
          >
            {/* Book ornament pattern overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="flex flex-col items-center text-center">
              {/* Logo / Embossed title */}
              <div className="relative mb-4">
                <img src="/logo.png" className="w-20 h-20 rounded-2xl object-cover shadow-lg border border-stone-700" alt="DreamVault Logo" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-stone-900 border border-stone-700 rounded-full flex items-center justify-center shadow">
                  <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                </div>
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-widest text-amber-100 mb-2">DREAMVAULT</h1>
              <p className="text-xs text-amber-200/60 uppercase tracking-widest mb-6">Digital Journal & Dream Archives</p>

              {/* Error alerts */}
              {errorMsg && (
                <div className="bg-red-950/50 border border-red-500 text-red-200 text-xs rounded-xl p-3 mb-4 w-full">
                  {errorMsg}
                </div>
              )}

              {/* Lockout status */}
              {lockUntil && (
                <div className="bg-stone-950/80 border border-amber-600/50 text-amber-200 text-xs rounded-xl p-3 mb-6 w-full flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                  Locked out due to retries. Try in 1 min.
                </div>
              )}

              {/* Setup form for new users */}
              {!hasSecuritySetup && !isLoadingDiary && (
                <form onSubmit={handleSetupSecurity} className="w-full space-y-3 text-left">
                  <h3 className="text-sm font-semibold text-amber-200 mb-2 text-center border-b border-white/10 pb-2">
                    Initialize Diary Security
                  </h3>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Create Diary Password</label>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="At least 4 characters..."
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={setupConfirm}
                      onChange={(e) => setSetupConfirm(e.target.value)}
                      placeholder="Repeat password..."
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Recovery Security Question</label>
                    <select
                      value={recoveryQuestion}
                      onChange={(e) => setRecoveryQuestion(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option>What was the name of your first pet?</option>
                      <option>What city were you born in?</option>
                      <option>What is your mother's maiden name?</option>
                      <option>What was the model of your first car?</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Recovery Answer</label>
                    <input
                      type="text"
                      value={recoveryAnswer}
                      onChange={(e) => setRecoveryAnswer(e.target.value)}
                      placeholder="Secret answer (case insensitive)..."
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 mt-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950"
                  >
                    <Key className="w-4 h-4" /> Save Lock Configuration
                  </button>
                </form>
              )}

              {/* Password unlock form */}
              {hasSecuritySetup && !isRecovering && (
                <form onSubmit={handleUnlock} className="w-full space-y-4">
                  <div className="relative">
                    <input
                      type="password"
                      value={passwordInput}
                      disabled={!!lockUntil}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={lockUntil ? 'Locked...' : 'Enter Diary Lock Password'}
                      className="w-full p-3 pl-10 pr-4 rounded-xl bg-stone-900/85 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    />
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-4" />
                  </div>
                  <button
                    type="submit"
                    disabled={!!lockUntil || !passwordInput}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-990/40 disabled:opacity-50"
                  >
                    <Unlock className="w-4 h-4" /> Open Diary Vault
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovering(true);
                      setErrorMsg('');
                    }}
                    className="text-xs text-amber-200/50 hover:underline hover:text-amber-200 mt-2 block mx-auto"
                  >
                    Forgot lock password? Answer recovery question
                  </button>
                </form>
              )}

              {/* Recovery Form */}
              {isRecovering && (
                <form onSubmit={handleRecover} className="w-full space-y-3 text-left">
                  <h3 className="text-sm font-semibold text-amber-200 mb-1 text-center flex items-center justify-center gap-1.5 border-b border-white/10 pb-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" /> Account Recovery Mode
                  </h3>
                  <div className="bg-stone-900/50 p-3 rounded-lg border border-stone-800 mb-2">
                    <p className="text-xs text-amber-200/60 uppercase tracking-widest mb-1">Security Question</p>
                    <p className="text-sm font-medium text-white">{securityRecord?.recovery_question}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Recovery Answer</label>
                    <input
                      type="text"
                      value={recoverAnswerInput}
                      onChange={(e) => setRecoverAnswerInput(e.target.value)}
                      placeholder="Answer..."
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-200/80 mb-1">Choose New Password</label>
                    <input
                      type="password"
                      value={recoverNewPassword}
                      onChange={(e) => setRecoverNewPassword(e.target.value)}
                      placeholder="At least 4 characters..."
                      className="w-full p-2.5 rounded-xl bg-stone-900/80 border border-stone-700 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRecovering(false)}
                      className="w-1/2 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm font-semibold hover:bg-stone-800 transition text-center"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition flex items-center justify-center gap-1.5"
                    >
                      Verify & Reset
                    </button>
                  </div>
                </form>
              )}

              {/* Logout button */}
              <button
                onClick={logout}
                className="mt-6 flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Log out of DreamVault session
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ----------------- DIARY UNLOCKED STATE ----------------- */}
      {isUnlocked && (
        <div className="w-full max-w-5xl flex flex-col md:flex-row relative">
          
          {/* CATEGORY SELECTOR (Mobile Dropdown vs Desktop Bookmark Tabs) */}
          
          {/* 1. MOBILE CATEGORY DROPDOWN */}
          <div className="w-full md:hidden mb-4 px-2 relative z-40" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-paper)] text-[var(--color-text)] border border-[var(--color-lines)] rounded-xl shadow-md font-semibold text-sm cursor-pointer hover:bg-[var(--bg-paper-back)] active:scale-[0.99] transition-all duration-200"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[var(--color-bookmark)]">
                  {getCategoryIcon(selectedCategoryTab)}
                </span>
                <span>{selectedCategoryTab === 'Starred' ? '★ Favorites' : selectedCategoryTab}</span>
              </div>
              <motion.div
                animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute left-2 right-2 mt-2 bg-[var(--bg-paper)] border border-[var(--color-lines)] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[var(--color-lines)]/50"
                >
                  {(['All', 'Daily Journal', 'Dream Journal', 'Personal Notes', 'Goals', 'Memories', 'Gratitude', 'Starred'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => {
                        setSelectedCategoryTab(tab);
                        setActivePage(1);
                        setIsCreatingNew(false);
                        setIsEditing(false);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors cursor-pointer text-left
                        ${selectedCategoryTab === tab
                          ? 'bg-[var(--color-bookmark)]/10 text-[var(--color-bookmark)] font-bold'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] hover:text-[var(--color-text)]'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={selectedCategoryTab === tab ? 'text-[var(--color-bookmark)]' : 'text-[var(--color-text-muted)]'}>
                          {getCategoryIcon(tab)}
                        </span>
                        <span>{tab === 'Starred' ? '★ Favorites' : tab}</span>
                      </div>
                      {selectedCategoryTab === tab && (
                        <Check className="w-4 h-4 text-[var(--color-bookmark)]" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. DESKTOP CATEGORY BOOKMARK INDEX TABS */}
          <div className="hidden md:flex flex-col gap-2 absolute -right-[94px] top-12 z-20 w-[94px]">
            {(['All', 'Daily Journal', 'Dream Journal', 'Personal Notes', 'Goals', 'Memories', 'Gratitude', 'Starred'] as const).map(tab => {
              const isSelected = selectedCategoryTab === tab;
              return (
                <motion.button
                  key={tab}
                  onClick={() => {
                    setSelectedCategoryTab(tab);
                    setActivePage(1);
                    setIsCreatingNew(false);
                    setIsEditing(false);
                  }}
                  whileHover={{ x: 6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`relative text-[10px] lg:text-xs font-semibold px-3 py-2.5 rounded-r-xl rounded-l-none border border-l-0 text-left transition-colors duration-200 whitespace-nowrap shadow-sm cursor-pointer select-none h-9 flex items-center
                    ${isSelected
                      ? 'text-white border-[var(--color-bookmark)] font-bold'
                      : 'bg-[var(--bg-paper-back)] text-[var(--color-text-muted)] border-[var(--color-lines)] hover:text-[var(--color-text)]'
                    }`}
                >
                  {/* Sliding active background indicator */}
                  {isSelected && (
                    <motion.div
                      layoutId="activeCategoryBookmark"
                      className="absolute inset-0 bg-[var(--color-bookmark)] rounded-r-xl z-[-1]"
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                  )}
                  <div className="flex items-center gap-1.5 z-10 relative">
                    <span className="opacity-90">{getCategoryIcon(tab)}</span>
                    <span className="truncate max-w-[68px]">
                      {tab === 'Starred' ? '★ Favs' : tab.replace(' Journal', '').replace(' Notes', '')}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* THE JOURNAL NOTEBOOK BOOK CONTAINER */}
          <div className="flex-1 bg-[var(--bg-cover)] border-0 md:border-8 md:border-[var(--bg-cover-border)] rounded-none md:rounded-3xl shadow-none md:shadow-[var(--shadow-book)] flex flex-col md:flex-row min-h-[580px] relative overflow-hidden w-full">
            
            {/* Book Spine Rings/Binder (Hidden on small screens, absolute middle on md+) */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-8 binder-spine -translate-x-1/2 z-30 shadow-[inset_-3px_0_5px_rgba(0,0,0,0.15),inset_3px_0_5px_rgba(0,0,0,0.15)]"></div>

            {/* ================= LEFT PAGE (TODAY DASHBOARD) ================= */}
            <div className="w-full md:w-1/2 bg-[var(--bg-paper-back)] border-b md:border-b-0 md:border-r border-[var(--color-lines)] p-6 flex flex-col justify-between select-none">
              
              {/* Header Date details */}
              <div className="border-b border-[var(--color-lines)] pb-4">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium mb-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>{formatDateLong(currentTime).split(',')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>{formatTime(currentTime)}</span>
                  </div>
                </div>
                <h2 className="text-xl font-serif font-bold text-[var(--color-text)] leading-tight mt-1">
                  {formatDateLong(currentTime).split(',')[1]}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] italic mt-1">
                  Today is a beautiful day to write.
                </p>
              </div>

              {/* Dashboard Content */}
              <div className="my-6 space-y-6 flex-1 overflow-y-auto pr-1">
                
                {/* Mood Tracker Selection Widget */}
                <div className="bg-[var(--bg-paper)] p-4 rounded-xl border border-[var(--color-lines)] shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" /> How is your mood today?
                  </h3>
                  <div className="grid grid-cols-6 gap-2">
                    {([
                      { emoji: '😀', mood: 'happy', label: 'Happy' },
                      { emoji: '😌', mood: 'calm', label: 'Calm' },
                      { emoji: '😢', mood: 'sad', label: 'Sad' },
                      { emoji: '😡', mood: 'angry', label: 'Angry' },
                      { emoji: '😴', mood: 'tired', label: 'Tired' },
                      { emoji: '🤩', mood: 'excited', label: 'Excited' },
                    ] as const).map(item => (
                      <button
                        key={item.mood}
                        onClick={() => handleQuickMoodSelect(item.mood)}
                        className="p-1.5 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] hover:border-[var(--color-accent)] rounded-lg hover:scale-105 active:scale-95 transition text-lg flex flex-col items-center gap-0.5 shadow-sm cursor-pointer"
                        title={item.label}
                      >
                        <span>{item.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Streak widget */}
                <div className="bg-[var(--bg-paper)] p-4 rounded-xl border border-[var(--color-lines)] shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                      <Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> Writing Streak
                    </h3>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'} current streak
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      Longest: {stats.longestStreak} days
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 font-bold border border-orange-500/30">
                    +{stats.currentStreak}
                  </div>
                </div>

                {/* Statistics Summary */}
                <div className="bg-[var(--bg-paper)] p-4 rounded-xl border border-[var(--color-lines)] shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Diary Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-[var(--bg-paper-back)] p-2.5 rounded-lg border border-[var(--color-lines)]">
                      <p className="text-lg font-bold text-[var(--color-text)]">{stats.totalEntries}</p>
                      <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Total Entries</p>
                    </div>
                    <div className="bg-[var(--bg-paper-back)] p-2.5 rounded-lg border border-[var(--color-lines)]">
                      <p className="text-lg font-bold text-[var(--color-text)]">{stats.totalDreams}</p>
                      <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Dreams Logged</p>
                    </div>
                  </div>
                </div>

                {/* Search / Go To Page */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActivePage(1);
                    }}
                    placeholder="Search titles, tags, text..."
                    className="w-full text-xs p-2.5 pl-8 rounded-lg bg-[var(--bg-paper)] border border-[var(--color-lines)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] shadow-inner"
                  />
                  <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)]/50 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* Bottom Profile details & Lock option */}
              <div className="flex items-center justify-between border-t border-[var(--color-lines)] pt-4 mt-2">
                <div className="flex items-center gap-2">
                  <img
                    src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                    alt="avatar"
                    className="w-8 h-8 rounded-full bg-[var(--bg-paper-back)] border border-[var(--color-lines)]"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text)]">{user?.full_name || user?.username}</h4>
                    <p className="text-[9px] text-[var(--color-text-muted)]">@{user?.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={lockDiary}
                    className="p-2 bg-[var(--bg-paper)] hover:bg-red-500/10 border border-[var(--color-lines)] rounded-lg text-red-500 transition shadow-sm cursor-pointer"
                    title="Lock Diary"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

            {/* ================= RIGHT PAGE (ENTRY WRITER / VIEWER) ================= */}
            <div className="w-full md:w-1/2 bg-[var(--bg-paper)] p-6 flex flex-col justify-between relative overflow-y-auto">
              
              {/* Starred ribbon bookmark (Absolute position top right of page) */}
              {activeEntry && activeEntry.is_favorite && (
                <div className="absolute right-6 top-0 w-6 h-10 bg-red-600 shadow-sm flex items-end justify-center pb-2 rounded-b-sm border-t-0 z-20">
                  <span className="text-white text-[9px] font-bold">★</span>
                </div>
              )}

              {/* LOADING DIARY LOADER */}
              {isLoadingDiary ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                  <Clock className="w-8 h-8 text-[var(--color-accent)] animate-spin mb-2" />
                  <p className="text-xs font-semibold">Decrypting Vault...</p>
                </div>
              ) : isEditing || isCreatingNew ? (
                /* WRITING / EDITING INTERFACE */
                <div className="flex-1 h-full">
                  <RichEditor
                    entry={isEditing ? activeEntry : undefined}
                    onSaveSuccess={() => {
                      setIsEditing(false);
                      setIsCreatingNew(false);
                    }}
                    onCancel={() => {
                      setIsEditing(false);
                      setIsCreatingNew(false);
                    }}
                  />
                </div>
              ) : (
                /* PAGE CONTENT VIEWER */
                <div className="flex-1 flex flex-col justify-between h-full">
                  
                  {/* Page Top Content */}
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between border-b border-[var(--color-lines)] pb-2 mb-4">
                      {activeEntry ? (
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span className="text-[10px] bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 px-2.5 py-0.5 rounded-full">
                            {activeEntry.category}
                          </span>
                          <span className="text-xs">
                            {activeEntry.mood === 'happy' && '😀'}
                            {activeEntry.mood === 'calm' && '😌'}
                            {activeEntry.mood === 'sad' && '😢'}
                            {activeEntry.mood === 'angry' && '😡'}
                            {activeEntry.mood === 'tired' && '😴'}
                            {activeEntry.mood === 'excited' && '🤩'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">Blank Page</span>
                      )}
                      
                      <div className="flex items-center gap-1.5">
                        {activeEntry && (
                          <>
                            <button
                              onClick={() => toggleFavorite(activeEntry.id)}
                              className="p-1 text-[var(--color-text-muted)] hover:text-amber-500 rounded transition cursor-pointer"
                              title="Toggle Favorite"
                            >
                              {activeEntry.is_favorite ? (
                                <BookmarkCheck className="w-4 h-4 text-amber-500 fill-amber-500" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setIsEditing(true)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] hover:bg-[var(--bg-paper)] text-[var(--color-text)] rounded transition font-bold cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </>
                        )}
                        
                        <button
                          onClick={() => setIsCreatingNew(true)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded transition font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> New
                        </button>
                      </div>
                    </div>

                    {/* Entry Title & Text */}
                    {activeEntry ? (
                      <div>
                        {/* Date stamp of entry */}
                        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-1">
                          {new Date(activeEntry.created_at).toLocaleString([], {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        
                        <h1 className="text-xl font-bold tracking-tight mb-4 text-[var(--color-text)]">
                          {activeEntry.title}
                        </h1>

                        <div className="notebook-paper handwriting-target text-[var(--color-text)] min-h-[280px] pr-2 focus:outline-none whitespace-pre-wrap leading-relaxed select-text">
                          {activeEntry.content}
                        </div>

                        {/* Tags list */}
                        {activeEntry.tags && activeEntry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-6 border-t border-[var(--color-lines)] pt-3">
                            {activeEntry.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-[10px] bg-[var(--bg-paper-back)] px-2.5 py-0.5 rounded-full text-[var(--color-text-muted)] border border-[var(--color-lines)] font-semibold"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* If diary is totally empty or activePage points to no entry */
                      <div className="flex flex-col items-center justify-center text-center py-20 text-[var(--color-text-muted)]">
                        <BookOpen className="w-12 h-12 text-[var(--color-accent)]/30 mb-3" />
                        <h3 className="font-serif text-lg font-bold text-[var(--color-text)]">No entries found</h3>
                        <p className="text-xs max-w-xs mt-1">
                          {searchQuery || selectedCategoryTab !== 'All'
                            ? 'Try clearing your search query or filters to browse pages.'
                            : 'This diary is clean and empty. Tap "New" above to write your first entry!'}
                        </p>
                        {(searchQuery || selectedCategoryTab !== 'All') && (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedCategoryTab('All');
                            }}
                            className="text-xs text-[var(--color-accent)] font-semibold hover:underline mt-4 cursor-pointer"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Page bottom Pagination controls */}
                  <div className="border-t border-[var(--color-lines)] pt-4 mt-6 flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
                    <button
                      disabled={activePage === 1}
                      onClick={() => setActivePage(activePage - 1)}
                      className="flex items-center gap-1 hover:text-[var(--color-text)] disabled:opacity-20 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev Page
                    </button>
                    
                    <span>
                      Page {filteredEntries.length > 0 ? activePage : 0} of {filteredEntries.length}
                    </span>

                    <button
                      disabled={activePage >= filteredEntries.length}
                      onClick={() => setActivePage(activePage + 1)}
                      className="flex items-center gap-1 hover:text-[var(--color-text)] disabled:opacity-20 transition cursor-pointer"
                    >
                      Next Page <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
