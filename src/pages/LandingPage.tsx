import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Feather,
  Shield,
  Mic,
  Smile,
  Calendar,
  Palette,
  BookOpen,
  Lock,
  Image,
  Tag,
  Star,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Moon,
  Sun,
  Zap,
  Heart,
  FileText,
  Github,
  Twitter,
  Mail,
  ExternalLink,
  Download,
  MessageCircle,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Tiny hook – animate a counter from 0 → target
───────────────────────────────────────────── */
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

/* ─────────────────────────────────────────────
   Animated section wrapper
───────────────────────────────────────────── */
const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'left' | 'right' | 'none';
}> = ({ children, delay = 0, className = '', direction = 'up' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 30 : 0,
      x: direction === 'left' ? -30 : direction === 'right' ? 30 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   Stat card with animated counter
───────────────────────────────────────────── */
const StatCard: React.FC<{
  value: number;
  suffix: string;
  label: string;
  delay: number;
}> = ({ value, suffix, label, delay }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCounter(value, 1600, inView);

  return (
    <div ref={ref} className="text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, delay }}
        className="text-4xl md:text-5xl font-bold text-[#8b5a2b] font-serif"
      >
        {count.toLocaleString()}
        {suffix}
      </motion.div>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Feature card
───────────────────────────────────────────── */
const FeatureCard: React.FC<{
  icon: React.ElementType;
  title: string;
  desc: string;
  accent: string;
  delay: number;
}> = ({ icon: Icon, title, desc, accent, delay }) => (
  <FadeIn delay={delay} direction="up">
    <div className="group relative bg-white/70 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
      <div
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 text-white shadow-md"
        style={{ background: accent }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-stone-800 mb-2">{title}</h3>
      <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
    </div>
  </FadeIn>
);

/* ─────────────────────────────────────────────
   Theme preview pill
───────────────────────────────────────────── */
const themes = [
  { name: 'Classic', bg: '#f2ebd9', accent: '#8b5a2b', cover: '#5c3a21' },
  { name: 'Dark',    bg: '#0f1115', accent: '#a855f7', cover: '#1a1e26' },
  { name: 'Vintage', bg: '#dfd2b5', accent: '#b8860b', cover: '#3d1414' },
  { name: 'Dream',   bg: '#120e2e', accent: '#ec4899', cover: '#1c1445' },
  { name: 'Minimal', bg: '#f3f4f6', accent: '#000000', cover: '#ffffff' },
];

/* ─────────────────────────────────────────────
   FAQ accordion item
───────────────────────────────────────────── */
const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-200 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 cursor-pointer group"
      >
        <span className="font-semibold text-stone-800 group-hover:text-[#8b5a2b] transition-colors">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm text-stone-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────────── */
export const LandingPage: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
  const [activeTheme, setActiveTheme] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position to lift the navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-rotate theme previews
  useEffect(() => {
    const t = setInterval(() => setActiveTheme(i => (i + 1) % themes.length), 2400);
    return () => clearInterval(t);
  }, []);

  const features = [
    {
      icon: Shield,
      title: 'AES-256-GCM Encryption',
      desc: 'Every entry is encrypted client-side before it ever leaves your device. Your diary key never touches our servers.',
      accent: 'linear-gradient(135deg,#8b5a2b,#c2593f)',
    },
    {
      icon: Mic,
      title: 'Encrypted Voice Memos',
      desc: 'Record thoughts hands-free. Voice memos are encrypted end-to-end just like your written entries.',
      accent: 'linear-gradient(135deg,#ec4899,#a855f7)',
    },
    {
      icon: Smile,
      title: 'Mood Analytics',
      desc: 'Track your emotional patterns with weekly and monthly mood charts. Spot trends and understand yourself better.',
      accent: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    },
    {
      icon: Calendar,
      title: 'Calendar View',
      desc: "Browse your entire journaling history at a glance. Jump straight to any day's entry from a beautiful calendar.",
      accent: 'linear-gradient(135deg,#10b981,#0ea5e9)',
    },
    {
      icon: Palette,
      title: '5 Beautiful Themes',
      desc: 'Classic Sepia, Dark Cosmic, Vintage Mahogany, Dream Violet, or Minimal Grid — switch themes any time.',
      accent: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    },
    {
      icon: Image,
      title: 'Encrypted Attachments',
      desc: 'Attach photos and images to your entries. All attachments are encrypted before upload — even your memories are private.',
      accent: 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
    },
    {
      icon: FileText,
      title: 'Markdown Support',
      desc: 'Write in plain text or use Markdown for rich formatting. Headers, bold, lists, quotes — your entries, your style.',
      accent: 'linear-gradient(135deg,#84cc16,#10b981)',
    },
    {
      icon: Tag,
      title: 'Tags & Categories',
      desc: 'Organise entries with tags and categories like Dream Journal, Goals, or Gratitude. Find any entry instantly.',
      accent: 'linear-gradient(135deg,#f97316,#ef4444)',
    },
    {
      icon: BookOpen,
      title: 'Auto-Save Drafts',
      desc: 'Never lose a thought. DreamVault silently drafts your entry as you type, restoring it exactly where you left off.',
      accent: 'linear-gradient(135deg,#8b5a2b,#b8860b)',
    },
  ];

  const faqs = [
    {
      q: 'Is my diary really private?',
      a: 'Yes. DreamVault encrypts every entry, voice memo, and attachment with AES-256-GCM on your device before anything is stored. Not even we can read your diary.',
    },
    {
      q: 'Do I need an account?',
      a: "An account ties your encrypted data to you so you can access it from any device. Without Supabase configured it falls back to fully local mode — nothing leaves your browser.",
    },
    {
      q: 'What happens if I forget my password?',
      a: 'You can request a password reset link via email. Because encryption is client-side, ensure you remember your diary unlock passphrase — that key is yours alone.',
    },
    {
      q: 'Can I export my entries?',
      a: 'Yes, DreamVault supports PDF export so you can keep a physical or offline copy of your journal entries any time.',
    },
    {
      q: 'Is DreamVault free?',
      a: 'DreamVault is free to use. All core features — encryption, voice memos, mood tracking, themes, and attachments — are included.',
    },
    {
      q: 'Does it work offline?',
      a: 'DreamVault is a Progressive Web App (PWA). Once installed it works offline, syncing your changes when you reconnect.',
    },
  ];

  const t = themes[activeTheme];

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-800 font-sans">

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 px-6 transition-all duration-300
          ${scrolled
            ? 'bg-[#faf7f2]/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-stone-200'
            : 'bg-[#faf7f2]/80 backdrop-blur-md border-b border-transparent'
          }`}
      >
        <div className={`max-w-6xl mx-auto flex items-center justify-between transition-all duration-300 ${scrolled ? 'py-2' : 'py-3.5'}`}>
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden shadow-md">
              <img src="/logo.png" alt="DreamVault" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-serif font-bold text-stone-800 tracking-wide block leading-none">DreamVault</span>
              <span className="text-[9px] text-stone-400 tracking-widest uppercase">Secure Diary</span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-500">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Themes',   href: '#themes'   },
              { label: 'Security', href: '#security' },
              { label: 'FAQ',      href: '#faq'      },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="relative py-1 hover:text-[#8b5a2b] transition-colors duration-150
                           after:absolute after:bottom-0 after:left-0 after:h-px after:w-0
                           after:bg-[#8b5a2b] after:transition-all after:duration-200
                           hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Login ghost button — desktop only */}
            <button
              onClick={onGetStarted}
              className="hidden md:inline-flex items-center text-sm font-medium text-stone-500 hover:text-[#8b5a2b] transition-colors duration-150 cursor-pointer"
            >
              Sign in
            </button>

            <button
              onClick={onGetStarted}
              className="hidden md:inline-flex items-center gap-2 bg-[#8b5a2b] hover:bg-[#5c3a21] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              Start Writing <ArrowRight className="w-4 h-4" />
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <div className="w-5 flex flex-col gap-[5px] items-end">
                <span className={`block h-0.5 bg-stone-600 rounded-full transition-all duration-300 origin-center
                  ${mobileMenuOpen ? 'w-5 rotate-45 translate-y-[7px]' : 'w-5'}`} />
                <span className={`block h-0.5 bg-stone-600 rounded-full transition-all duration-200
                  ${mobileMenuOpen ? 'opacity-0 w-0' : 'w-3.5'}`} />
                <span className={`block h-0.5 bg-stone-600 rounded-full transition-all duration-300 origin-center
                  ${mobileMenuOpen ? 'w-5 -rotate-45 -translate-y-[7px]' : 'w-5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden"
            >
              <div className="border-t border-stone-200/70 mt-1 pb-4">
                <nav className="flex flex-col gap-1 pt-3">
                  {[
                    { label: 'Features', href: '#features' },
                    { label: 'Themes',   href: '#themes'   },
                    { label: 'Security', href: '#security' },
                    { label: 'FAQ',      href: '#faq'      },
                  ].map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-amber-50 hover:text-[#8b5a2b] transition-all duration-150"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" />
                      {label}
                    </a>
                  ))}
                </nav>

                <div className="flex gap-3 mt-3 px-1">
                  <button
                    onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}
                    className="flex-1 flex items-center justify-center gap-2 border border-stone-200 text-stone-600 text-sm font-medium py-2.5 rounded-xl hover:bg-stone-50 transition cursor-pointer"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#8b5a2b] hover:bg-[#5c3a21] text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer"
                  >
                    Start free <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-20 px-6">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-amber-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-orange-100/40 blur-3xl" />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left copy */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-amber-100 text-[#8b5a2b] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-amber-200"
              >
                <Lock className="w-3 h-3" />
                AES-256-GCM End-to-End Encrypted
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl font-serif font-bold text-stone-900 leading-tight mb-6"
              >
                Your thoughts,{' '}
                <span className="text-[#8b5a2b] italic">yours alone.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-stone-500 leading-relaxed mb-8 max-w-lg"
              >
                DreamVault is a beautiful encrypted personal diary. Write, record voice memos,
                attach photos, and track your moods — everything locked behind military-grade
                encryption that only you control.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4 mb-10"
              >
                <button
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 bg-[#8b5a2b] hover:bg-[#5c3a21] text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg shadow-amber-900/20 transition-all duration-200 text-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Start Your Diary — Free
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 text-[#8b5a2b] font-semibold text-sm hover:underline cursor-pointer"
                >
                  See all features <ChevronDown className="w-4 h-4" />
                </a>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-5 text-xs text-stone-400"
              >
                {[
                  { icon: Shield, text: 'Zero-knowledge encryption' },
                  { icon: Zap,    text: 'Works offline (PWA)' },
                  { icon: Heart,  text: '100% free, no ads' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 font-medium">
                    <Icon className="w-3.5 h-3.5 text-[#8b5a2b]" />
                    {text}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right – animated diary mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:flex justify-center"
            >
              <div className="relative w-80">
                {/* Book shadow */}
                <div className="absolute inset-0 bg-stone-400/20 blur-2xl rounded-3xl translate-y-4" />

                {/* Diary cover */}
                <div
                  className="relative rounded-2xl overflow-hidden shadow-2xl border border-amber-900/20"
                  style={{ background: '#5c3a21' }}
                >
                  {/* Spine */}
                  <div className="absolute left-0 top-0 bottom-0 w-6 bg-black/20" />

                  {/* Cover content */}
                  <div className="pl-10 pr-6 pt-8 pb-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg overflow-hidden shadow flex-shrink-0">
                        <img src="/logo.png" alt="DreamVault" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-serif font-bold text-amber-100 tracking-wide">DreamVault</span>
                    </div>

                    {/* Page preview */}
                    <div className="bg-[#fcfaf2] rounded-xl p-4 shadow-inner space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Page 42</span>
                        <span className="text-[9px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">😀 Happy</span>
                      </div>
                      <div className="h-px bg-stone-200" />
                      <p className="text-xs font-bold text-stone-700">A morning walk at sunrise</p>
                      <div className="space-y-1.5">
                        {['Woke up early to catch the sunrise at the park.', 'The golden light on the water was breathtaking…', 'Grateful for these quiet moments.'].map((line, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <div className="w-4 h-px bg-stone-200 mt-2 flex-shrink-0" />
                            <p className="text-[10px] text-stone-500 leading-relaxed">{line}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {['gratitude', 'morning', 'nature'].map(tag => (
                          <span key={tag} className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">#{tag}</span>
                        ))}
                      </div>
                    </div>

                    {/* Mood bar preview */}
                    <div className="mt-4 bg-[#fcfaf2] rounded-xl p-3 shadow-inner">
                      <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-2">Mood this week</p>
                      {[
                        { emoji: '😀', label: 'Happy', pct: 60, color: '#22c55e' },
                        { emoji: '😌', label: 'Calm',  pct: 25, color: '#14b8a6' },
                        { emoji: '😢', label: 'Sad',   pct: 15, color: '#3b82f6' },
                      ].map(m => (
                        <div key={m.label} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px]">{m.emoji}</span>
                          <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${m.pct}%` }}
                              transition={{ duration: 1, delay: 0.8 }}
                              className="h-full rounded-full"
                              style={{ background: m.color }}
                            />
                          </div>
                          <span className="text-[9px] text-stone-400 w-6 text-right">{m.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="absolute -right-6 top-10 bg-white rounded-2xl shadow-xl border border-stone-100 px-3 py-2 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-[10px] font-bold text-stone-700">Encrypted</span>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute -left-8 bottom-16 bg-white rounded-2xl shadow-xl border border-stone-100 px-3 py-2 flex items-center gap-2"
                >
                  <Mic className="w-4 h-4 text-[#c2593f]" />
                  <span className="text-[10px] font-bold text-stone-700">Voice memo</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section className="bg-white border-y border-stone-200 py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <StatCard value={256}    suffix="-bit" label="Encryption key strength"  delay={0}    />
          <StatCard value={5}      suffix="+"    label="Unique diary themes"       delay={0.15} />
          <StatCard value={6}      suffix=""     label="Mood categories tracked"   delay={0.3}  />
          <StatCard value={100}    suffix="%"    label="Client-side encryption"    delay={0.45} />
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#8b5a2b] uppercase tracking-widest">Everything you need</span>
              <h2 className="mt-2 text-4xl font-serif font-bold text-stone-900">
                Built for your most private moments
              </h2>
              <p className="mt-4 text-stone-500 max-w-xl mx-auto leading-relaxed">
                Every feature was designed with privacy first. Write, reflect, and grow — with the confidence that no one else will ever read a word.
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.06} />
            ))}
          </div>
        </div>
      </section>

      {/* ── THEMES ──────────────────────────────────────────── */}
      <section id="themes" className="py-24 px-6 bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeIn direction="left">
              <span className="text-xs font-bold text-[#8b5a2b] uppercase tracking-widest">Personalise</span>
              <h2 className="mt-2 text-4xl font-serif font-bold text-stone-900 mb-4">
                Five handcrafted themes
              </h2>
              <p className="text-stone-500 leading-relaxed mb-8">
                From warm sepia to deep cosmic, each theme transforms DreamVault into a completely different journaling atmosphere. Switch any time from Settings.
              </p>

              <div className="space-y-3">
                {themes.map((theme, i) => (
                  <button
                    key={theme.name}
                    onClick={() => setActiveTheme(i)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 text-left cursor-pointer
                      ${activeTheme === i
                        ? 'border-[#8b5a2b] bg-amber-50 shadow-sm'
                        : 'border-stone-200 hover:border-stone-300 bg-white'}`}
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-black/10" style={{ background: theme.bg }}>
                      <div className="absolute left-0 top-0 bottom-0 w-3" style={{ background: theme.cover }} />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm" style={{ background: theme.accent, opacity: 0.8 }} />
                    </div>
                    <span className={`text-sm font-semibold ${activeTheme === i ? 'text-[#8b5a2b]' : 'text-stone-600'}`}>
                      {theme.name}
                    </span>
                    {activeTheme === i && <CheckCircle2 className="w-4 h-4 text-[#8b5a2b] ml-auto" />}
                  </button>
                ))}
              </div>
            </FadeIn>

            {/* Live theme preview */}
            <FadeIn direction="right" delay={0.15}>
              <div className="flex justify-center">
                <motion.div
                  key={activeTheme}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-72 rounded-2xl overflow-hidden shadow-2xl border border-black/10"
                  style={{ background: t.bg }}
                >
                  {/* Header bar */}
                  <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: `${t.cover}22`, background: `${t.cover}11` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
                        <img src="/logo.png" alt="DreamVault" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: t.accent }}>DreamVault</span>
                    </div>
                    <div className="flex gap-1">
                      {['Journal', 'Calendar', 'Mood'].map(l => (
                        <span key={l} className="text-[7px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${t.accent}20`, color: t.accent }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Diary book */}
                  <div className="p-4">
                    <div className="rounded-xl overflow-hidden shadow-lg" style={{ background: '#fcfaf200' }}>
                      <div className="flex" style={{ minHeight: 200 }}>
                        {/* Spine */}
                        <div className="w-5 flex-shrink-0 rounded-l-xl" style={{ background: t.cover }} />
                        {/* Page */}
                        <div className="flex-1 p-4 rounded-r-xl" style={{ background: t.bg, border: `1px solid ${t.accent}22` }}>
                          <p className="text-[9px] font-bold mb-2" style={{ color: t.accent }}>Today's Entry</p>
                          {[80, 65, 90, 50, 75].map((w, i) => (
                            <div key={i} className="h-1.5 rounded mb-1.5 last:mb-0" style={{ width: `${w}%`, background: `${t.accent}30` }} />
                          ))}
                          <div className="mt-3 flex gap-1">
                            {['#dream', '#calm'].map(t2 => (
                              <span key={t2} className="text-[7px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${t.accent}18`, color: t.accent }}>
                                {t2}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom nav preview */}
                    <div className="mt-4 flex justify-around py-2 rounded-xl" style={{ background: `${t.cover}15` }}>
                      {[BookOpen, Calendar, Smile].map((Icon, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: i === 0 ? t.accent : 'transparent' }}>
                            <Icon className="w-3 h-3" style={{ color: i === 0 ? '#fff' : t.accent, opacity: i === 0 ? 1 : 0.5 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Theme label */}
                  <div className="text-center pb-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.accent }}>
                      {t.name} Theme
                    </span>
                  </div>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── SECURITY ────────────────────────────────────────── */}
      <section id="security" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#8b5a2b] uppercase tracking-widest">Zero-knowledge</span>
              <h2 className="mt-2 text-4xl font-serif font-bold text-stone-900">
                Security you can trust
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: 'Client-Side Encryption',
                desc: 'Encryption and decryption happen entirely in your browser using AES-256-GCM. Your plaintext diary entries never travel over the network.',
                color: '#8b5a2b',
              },
              {
                icon: Shield,
                title: 'Zero-Knowledge Architecture',
                desc: 'Your encryption key is derived from your personal passphrase. The server stores only ciphertext — it is mathematically impossible for us to read your diary.',
                color: '#c2593f',
              },
              {
                icon: Star,
                title: 'Encrypted Attachments',
                desc: 'Photos and voice memos are encrypted on-device before upload. Even if the storage bucket were exposed, all it would reveal is unreadable binary data.',
                color: '#b8860b',
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl p-7 text-white h-full">
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-5 text-white"
                    style={{ background: `${item.color}33`, border: `1px solid ${item.color}55` }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.color === '#8b5a2b' ? '#c9956a' : item.color === '#c2593f' ? '#e8816b' : '#d4a42a' }} />
                  </div>
                  <h3 className="font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-stone-300 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* AES info strip */}
          <FadeIn delay={0.3}>
            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-wrap gap-8 justify-around text-center">
              {[
                { label: 'Algorithm',  value: 'AES-256-GCM' },
                { label: 'Mode',       value: 'Galois/Counter' },
                { label: 'Key length', value: '256-bit' },
                { label: 'Auth tag',   value: '128-bit' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{label}</p>
                  <p className="mt-1 font-bold text-stone-800 font-mono">{value}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-stone-50 border-y border-stone-200">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-[#8b5a2b] uppercase tracking-widest">Simple</span>
              <h2 className="mt-2 text-4xl font-serif font-bold text-stone-900">
                Start in three steps
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-stone-200 z-0" />

            {[
              {
                step: '01',
                icon: BookOpen,
                title: 'Create your account',
                desc: 'Sign up with your email, choose a secure passphrase. Your diary is automatically created and ready.',
              },
              {
                step: '02',
                icon: Lock,
                title: 'Unlock your vault',
                desc: 'Enter your passphrase to decrypt your diary. Only you know this key — we never see it.',
              },
              {
                step: '03',
                icon: Feather,
                title: 'Write freely',
                desc: 'Journal daily, attach photos, record voice memos, track your moods. Everything saved with AES-256-GCM.',
              },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.12} direction="up">
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-16 h-16 bg-white border-2 border-stone-200 rounded-2xl flex items-center justify-center shadow-md mb-5">
                    <s.icon className="w-7 h-7 text-[#8b5a2b]" />
                  </div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{s.step}</span>
                  <h3 className="font-bold text-stone-800 mb-2">{s.title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="text-xs font-bold text-[#8b5a2b] uppercase tracking-widest">Questions</span>
              <h2 className="mt-2 text-4xl font-serif font-bold text-stone-900">
                Frequently asked
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="bg-white border border-stone-200 rounded-2xl px-6 shadow-sm">
              {faqs.map(faq => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <div className="bg-gradient-to-br from-[#5c3a21] to-[#3d1414] rounded-3xl p-12 shadow-2xl text-white relative overflow-hidden">
              {/* Decorative circles */}
              <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
              <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 overflow-hidden shadow-xl">
                  <img src="/logo.png" alt="DreamVault" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-4xl font-serif font-bold mb-4 leading-tight">
                  Your diary is waiting.
                </h2>
                <p className="text-amber-200/80 mb-8 text-lg leading-relaxed">
                  Join thousands of writers who trust DreamVault to keep their deepest thoughts private, safe, and beautifully organised.
                </p>
                <button
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-3 bg-white text-[#5c3a21] font-bold px-8 py-4 rounded-2xl hover:bg-amber-50 transition-all duration-200 shadow-xl text-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Open DreamVault — It's Free
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="mt-4 text-xs text-amber-200/50">No credit card required. No ads. No tracking.</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400">

        {/* Top — 4-column grid */}
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

            {/* Col 1 — Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden shadow-md">
                  <img src="/logo.png" alt="DreamVault" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="font-serif font-bold text-white text-sm block leading-tight">DreamVault</span>
                  <span className="text-[9px] text-stone-500 tracking-widest uppercase">Secure Diary</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-stone-500 mb-5 max-w-[220px]">
                Your private encrypted journal. Write freely — protected by AES-256-GCM encryption that only you control.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3">
                {[
                  { icon: Github,         href: '#', label: 'GitHub'   },
                  { icon: Twitter,        href: '#', label: 'Twitter'  },
                  { icon: Mail,           href: '#', label: 'Email'    },
                  { icon: MessageCircle,  href: '#', label: 'Discord'  },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-[#8b5a2b] border border-stone-700 hover:border-[#8b5a2b] flex items-center justify-center transition-all duration-200"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Col 2 — Product */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Product</h4>
              <ul className="space-y-3">
                {[
                  { label: 'Features',      href: '#features'  },
                  { label: 'Themes',        href: '#themes'    },
                  { label: 'Security',      href: '#security'  },
                  { label: 'How it works',  href: '#'          },
                  { label: 'Changelog',     href: '#'          },
                  { label: 'Roadmap',       href: '#'          },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-xs text-stone-500 hover:text-white transition-colors duration-150 flex items-center gap-1.5 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-stone-700 group-hover:bg-[#8b5a2b] transition-colors flex-shrink-0" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Resources */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Resources</h4>
              <ul className="space-y-3">
                {[
                  { label: 'FAQ',               href: '#faq', ext: false },
                  { label: 'Privacy Policy',    href: '#',    ext: false },
                  { label: 'Terms of Service',  href: '#',    ext: false },
                  { label: 'Documentation',     href: '#',    ext: true  },
                  { label: 'Open Source',       href: '#',    ext: true  },
                  { label: 'Status',            href: '#',    ext: true  },
                ].map(({ label, href, ext }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-xs text-stone-500 hover:text-white transition-colors duration-150 flex items-center gap-1.5 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-stone-700 group-hover:bg-[#8b5a2b] transition-colors flex-shrink-0" />
                      {label}
                      {ext && <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity ml-auto" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 — Install / Get started */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Get the app</h4>
              <p className="text-xs text-stone-500 leading-relaxed mb-4">
                DreamVault is a PWA — install it on any device, no app store needed.
              </p>
              <button
                onClick={onGetStarted}
                className="w-full flex items-center justify-center gap-2 bg-[#8b5a2b] hover:bg-[#5c3a21] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all duration-200 cursor-pointer mb-3"
              >
                
                Start for free
              </button>
              <button
                onClick={onGetStarted}
                className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install as PWA
              </button>

              {/* Encryption badge */}
              
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-stone-800" />

        {/* Bottom bar */}
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-600 order-2 sm:order-1">
            © {new Date().getFullYear()} DreamVault. All rights reserved.
          </p>

         

          <div className="flex items-center gap-4 order-3 text-xs text-stone-600">
            <div className="flex items-center gap-1.5">
              <Moon className="w-3 h-3" />
              <Sun className="w-3 h-3" />
              <span>5 themes</span>
            </div>
            <span>·</span>
            <span>Made with <Heart className="w-3 h-3 inline text-red-500" /> for privacy</span>
          </div>
        </div>

      </footer>

    </div>
  );
};
