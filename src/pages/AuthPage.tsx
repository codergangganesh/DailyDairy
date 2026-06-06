import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Feather, ArrowRight, Shield } from 'lucide-react';
import { motion } from 'framer-motion';


export const AuthPage: React.FC = () => {
  const { login, signUp, resetPassword, isLoading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Form values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !password) {
      setErrorMsg('Please fill in email and password.');
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!username || !fullName) {
          setErrorMsg('Please fill in username and full name.');
          return;
        }
        await signUp(email, password, username, fullName);
      }
    } catch (err: any) {
      if (err.message && err.message.startsWith('VERIFY_EMAIL:')) {
        setInfoMsg(err.message.replace('VERIFY_EMAIL:', '').trim());
      } else {
        setErrorMsg(err.message || 'Authentication operation failed.');
      }
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email) {
      setErrorMsg('Please enter your email.');
      return;
    }

    try {
      await resetPassword(email);
      setInfoMsg('If the account exists, a recovery log request has been logged.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit password recovery');
    }
  };

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center py-10 px-4 select-none">
      
      {/* Decorative Brand Header */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8 flex flex-col items-center"
      >
        <img src="/logo.png" className="w-16 h-16 rounded-2xl object-cover shadow-lg border border-[var(--bg-cover-border)] mb-3.5" alt="DreamVault Logo" />
        <h1 className="text-3xl font-serif font-bold tracking-wider text-[var(--color-accent)]">DreamVault</h1>
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest mt-1">E2E Cryptographic Diary & Dream Journal</p>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-[var(--bg-paper)] rounded-2xl shadow-xl border border-[var(--color-lines)] p-6 md:p-8"
      >
        {/* Error / Info messages */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl p-3 mb-4 font-semibold">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-500 text-xs rounded-xl p-3 mb-4 font-semibold">
            {infoMsg}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {isForgotPassword ? (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-text)]">Password Recovery</h2>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Enter your email to search for your account security logs. Remember, diary locks are client-side and require your recovery question instead of email resets.
            </p>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Account Email"
                className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <Mail className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
            >
              Send Reset Request
            </button>
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg('');
                setInfoMsg('');
              }}
              className="text-xs text-[var(--color-text-muted)] hover:underline hover:text-[var(--color-text)] block mx-auto pt-2 cursor-pointer"
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          /* LOGIN OR SIGNUP FORM */
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-text)]">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-[10px] text-[var(--color-text-muted)] -mt-3 uppercase tracking-wider flex items-center gap-1 font-semibold">
              <Shield className="w-3.5 h-3.5 text-green-500" /> Secure Encryption Shield Active
            </p>

            {!isLogin && (
              <>
                {/* Full name input */}
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                  <User className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
                </div>
                {/* Username input */}
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                  <User className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
                </div>
              </>
            )}

            {/* Email input */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
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
                placeholder="Account Password"
                className="w-full p-2.5 pl-9 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <Lock className="w-4 h-4 text-[var(--color-text-muted)]/60 absolute left-3 top-3.5" />
            </div>

            {isLogin && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:underline block ml-auto cursor-pointer"
              >
                Forgot Password?
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>{isLogin ? 'Sign In' : 'Create Vault'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Toggle login/signup */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:underline cursor-pointer"
              >
                {isLogin ? "New user? Create a vault" : "Already have a vault? Sign In"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
