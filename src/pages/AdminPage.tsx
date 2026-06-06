import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminDashboard } from '../components/AdminDashboard/AdminDashboard';
import { ShieldCheck, Lock, Mail, ArrowRight, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';


export const AdminPage: React.FC = () => {
  const { user, role, adminLogin, logout, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      await adminLogin(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Admin authentication failed.');
    }
  };

  // If already logged in as admin, show dashboard
  if (user && role === 'admin') {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col justify-between">
        <header className="bg-[var(--bg-paper)] border-b border-[var(--color-lines)] px-4 py-3 sticky top-0 z-40 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[var(--color-accent)]" />
              <span className="font-bold text-sm tracking-wide text-[var(--color-text)]">DreamVault Admin Console</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit Admin Session
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          <AdminDashboard />
        </main>

        <footer className="py-4 border-t border-[var(--color-lines)] text-center text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--bg-paper)]">
          DreamVault Administration Console • All Actions Audited
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] py-10 px-4 select-none">
      
      {/* Brand Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8 flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-[var(--bg-cover)] rounded-2xl flex items-center justify-center shadow-lg border border-[var(--bg-cover-border)] mb-3.5">
          <ShieldCheck className="w-8 h-8 text-[var(--bg-paper)]" />
        </div>
        <h1 className="text-2xl font-bold tracking-wide text-[var(--color-text)]">DreamVault</h1>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Administrator Portal</p>
      </motion.div>

      {/* Login Card */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-[var(--bg-paper)] rounded-2xl shadow-xl border border-[var(--color-lines)] p-6 md:p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-md font-bold text-[var(--color-text)] flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[var(--color-accent)]" /> Administrative Sign In
          </h2>
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-2 leading-relaxed">
            Authorized personnel only. Access attempt logs are written to systems audit sheets.
          </p>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl p-3 mb-1 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Email input */}
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin Email"
              className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <Mail className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
          </div>

          {/* Password input */}
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <Lock className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1 shadow-md cursor-pointer"
          >
            <span>Authenticate Admin</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </motion.div>
      
      <a
        href="/"
        className="mt-6 text-xs text-[var(--color-text-muted)] hover:underline hover:text-[var(--color-text)] flex items-center gap-1"
      >
        Return to standard user entry
      </a>
    </div>
  );
};
