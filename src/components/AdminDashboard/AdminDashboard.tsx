import React, { useState, useEffect } from 'react';
import { dbService, type Profile, type ActivityLog, supabase, isSupabaseConfigured } from '../../services/dbService';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Activity,
  Database,
  ShieldAlert,
  UserX,
  UserCheck,
  RotateCcw,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Search,
  TrendingUp,
  BookOpen,
  Clock,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserDiaryViewer } from './UserDiaryViewer';

export const AdminDashboard: React.FC = () => {
  const { user: adminUser } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'storage'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [storageStats, setStorageStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalEntries: 0,
    totalLogs: 0,
    storageKB: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const allProfiles = await dbService.getAllProfiles();
      setUsers(allProfiles);

      const allLogs = await dbService.getActivityLogs();
      setLogs(allLogs);

      // Storage stats
      let totalEntries = 0;
      let storageKB = 0;

      if (isSupabaseConfigured && supabase) {
        const { count } = await supabase
          .from('entries')
          .select('*', { count: 'exact', head: true });
        totalEntries = count ?? 0;
        storageKB = 0; // Supabase manages storage
      } else {
        const entriesStr = localStorage.getItem('dreamvault_entries') || '[]';
        const securityStr = localStorage.getItem('dreamvault_security') || '[]';
        const profilesStr = localStorage.getItem('dreamvault_profiles') || '[]';
        totalEntries = JSON.parse(entriesStr).length;
        storageKB = (entriesStr.length + securityStr.length + profilesStr.length) / 1024;
      }

      setStorageStats({
        totalUsers: allProfiles.length,
        activeUsers: allProfiles.filter(p => !p.suspended).length,
        suspendedUsers: allProfiles.filter(p => p.suspended).length,
        totalEntries,
        totalLogs: allLogs.length,
        storageKB,
      });
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSuspend = async (user: Profile) => {
    const nextState = !user.suspended;
    const action = nextState ? 'suspend' : 'unsuspend';
    if (!window.confirm(`Are you sure you want to ${action} @${user.username}?`)) return;

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({ suspended: nextState })
          .eq('id', user.id);
        if (error) throw error;
      } else {
        await dbService.updateProfile(user.id, { suspended: nextState });
      }
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin ${action}ed user @${user.username}`);
      }
      loadData();
    } catch (err) {
      alert('Failed to update suspension status');
    }
  };

  const handleClearLockout = async (userId: string, username: string) => {
    if (!window.confirm(`Clear diary password lockout for @${username}?`)) return;
    try {
      // Always clear localStorage lockout regardless of mode
      localStorage.removeItem(`dreamvault_lockout_${userId}`);
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin cleared lockout for @${username}`);
      }
      alert('Lockout cleared. User can try their diary password again.');
      loadData();
    } catch (err) {
      alert('Failed to clear lockout');
    }
  };

  const handleHardResetDiary = async (userId: string, username: string) => {
    if (!window.confirm(`WARNING: This will DELETE all encrypted entries for @${username} and remove their diary lock. This cannot be undone. Proceed?`)) return;
    if (!window.confirm(`Second confirmation: Permanently wipe diary data for @${username}?`)) return;

    try {
      if (isSupabaseConfigured && supabase) {
        // Delete entries from Supabase
        await supabase.from('entries').delete().eq('user_id', userId);
        // Delete diary_security record
        await supabase.from('diary_security').delete().eq('user_id', userId);
      } else {
        const security = JSON.parse(localStorage.getItem('dreamvault_security') || '[]');
        localStorage.setItem('dreamvault_security', JSON.stringify(security.filter((s: any) => s.user_id !== userId)));
        const entries = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]');
        localStorage.setItem('dreamvault_entries', JSON.stringify(entries.filter((e: any) => e.user_id !== userId)));
      }
      localStorage.removeItem(`dreamvault_lockout_${userId}`);
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin hard-reset diary for @${username}`);
      }
      alert(`Diary reset for @${username}. They can set a new lock on next login.`);
      loadData();
    } catch (err) {
      alert('Failed to reset diary');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Permanently DELETE account @${username} and all their data? This cannot be undone.`)) return;

    try {
      if (isSupabaseConfigured && supabase) {
        // Cascade deletes handle entries, diary_security, diaries via FK ON DELETE CASCADE
        // We can only delete from profiles; auth.users deletion requires service_role key
        await supabase.from('entries').delete().eq('user_id', userId);
        await supabase.from('diary_security').delete().eq('user_id', userId);
        await supabase.from('diaries').delete().eq('user_id', userId);
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
      } else {
        ['dreamvault_profiles', 'dreamvault_entries', 'dreamvault_security'].forEach(key => {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify(data.filter((r: any) => r.id !== userId && r.user_id !== userId)));
        });
        const authUsers = JSON.parse(localStorage.getItem('dreamvault_mock_auth_users') || '[]');
        localStorage.setItem('dreamvault_mock_auth_users', JSON.stringify(authUsers.filter((u: any) => u.id !== userId)));
      }
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin deleted account @${username}`);
      }
      alert(`Account @${username} deleted.`);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'overview', label: 'Overview',   icon: TrendingUp },
    { id: 'users',    label: `Users (${users.length})`, icon: Users },
    { id: 'logs',     label: `Audit Logs (${logs.length})`, icon: Activity },
    { id: 'storage',  label: 'Storage',    icon: Database },
  ] as const;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 select-none">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text)]">
            <ShieldCheck className="w-5 h-5 text-[var(--color-accent)]" />
            Admin Dashboard
          </h1>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Signed in as <span className="font-semibold text-[var(--color-text)]">{adminUser?.full_name}</span>
            <span className="text-[var(--color-text-muted)]"> · @{adminUser?.username}</span>
            {isSupabaseConfigured
              ? <span className="ml-2 px-1.5 py-0.5 bg-green-500/10 text-green-600 text-[9px] font-bold rounded border border-green-500/20">SUPABASE</span>
              : <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-bold rounded border border-amber-500/20">MOCK MODE</span>
            }
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-paper-back)] hover:bg-[var(--bg-paper)] text-[var(--color-text)] text-xs font-bold rounded-lg border border-[var(--color-lines)] transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-[var(--color-lines)] gap-0.5 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer
                ${activeTab === tab.id
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--color-accent)] mb-2" />
          <p className="text-xs text-[var(--color-text-muted)]">Loading data…</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >

            {/* ═══════ OVERVIEW TAB ═══════ */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Users',      value: storageStats.totalUsers,     icon: Users,    color: 'text-blue-500',   bg: 'bg-blue-500/10' },
                    { label: 'Active',           value: storageStats.activeUsers,    icon: UserCheck,color: 'text-green-500',  bg: 'bg-green-500/10' },
                    { label: 'Suspended',        value: storageStats.suspendedUsers, icon: UserX,    color: 'text-red-500',    bg: 'bg-red-500/10' },
                    { label: 'Total Entries',    value: storageStats.totalEntries,   icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                    { label: 'Audit Log Events', value: storageStats.totalLogs,      icon: Activity, color: 'text-amber-500',  bg: 'bg-amber-500/10' },
                    { label: 'Storage Used',     value: isSupabaseConfigured ? 'Supabase' : `${storageStats.storageKB.toFixed(1)} KB`, icon: Database, color: 'text-teal-500', bg: 'bg-teal-500/10' },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="bg-[var(--bg-paper)] p-4 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                        <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                          <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <p className="text-xl font-extrabold text-[var(--color-text)]">{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Recent activity */}
                <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Recent Activity
                  </h3>
                  <div className="space-y-2">
                    {logs.slice(0, 8).map(log => (
                      <div key={log.id} className="flex items-start justify-between gap-4 text-xs p-2.5 bg-[var(--bg-paper-back)] rounded-xl border border-[var(--color-lines)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-[var(--color-accent)] shrink-0">@{log.username}</span>
                          <span className="text-[var(--color-text)] truncate">{log.action}</span>
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No activity recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ USERS TAB ═══════ */}
            {activeTab === 'users' && (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search by name or username…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-paper)] border border-[var(--color-lines)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--bg-paper-back)] border-b border-[var(--color-lines)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                          <th className="p-4">User</th>
                          <th className="p-4">Username</th>
                          <th className="p-4">Joined</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-lines)]">
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-xs text-[var(--color-text-muted)]">
                              No users found.
                            </td>
                          </tr>
                        )}
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-[var(--bg-paper-back)]/40 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    u.avatar_url?.startsWith('data:') || u.avatar_url?.startsWith('http')
                                      ? u.avatar_url
                                      : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`
                                  }
                                  className="w-8 h-8 rounded-full bg-[var(--bg-paper-back)] border border-[var(--color-lines)] object-cover"
                                  alt="avatar"
                                />
                                <div>
                                  <p className="font-bold text-[var(--color-text)]">{u.full_name || 'N/A'}</p>
                                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{u.id.substring(0, 8)}…</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => setViewingUser(u)}
                                className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline transition cursor-pointer"
                              >
                                @{u.username}
                              </button>
                            </td>
                            <td className="p-4 text-[var(--color-text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                u.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                  : 'bg-[var(--bg-paper-back)] text-[var(--color-text)] border-[var(--color-lines)]'
                              }`}>
                                {u.role.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                u.suspended
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : 'bg-green-500/10 text-green-500 border-green-500/20'
                              }`}>
                                {u.suspended ? 'SUSPENDED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {u.role !== 'admin' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setViewingUser(u)}
                                    title="View diary entries"
                                    className="p-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleSuspend(u)}
                                    title={u.suspended ? 'Unsuspend' : 'Suspend'}
                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                      u.suspended
                                        ? 'border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                        : 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                    }`}
                                  >
                                    {u.suspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    onClick={() => handleClearLockout(u.id, u.username)}
                                    title="Clear diary lockout"
                                    className="p-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:bg-[var(--bg-paper)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleHardResetDiary(u.id, u.username)}
                                    title="Hard reset diary lock (deletes entries)"
                                    className="p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition cursor-pointer"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    title="Delete account"
                                    className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-[var(--color-text-muted)] italic">protected</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ LOGS TAB ═══════ */}
            {activeTab === 'logs' && (
              <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5 border-b border-[var(--color-lines)] pb-3">
                  <Activity className="w-4 h-4 text-[var(--color-accent)]" />
                  Full Audit Log
                  <span className="ml-auto font-normal normal-case text-[var(--color-text-muted)]">{logs.length} events</span>
                </h3>
                <div className="max-h-[520px] overflow-y-auto pr-1 space-y-1.5">
                  {logs.map(log => (
                    <div
                      key={log.id}
                      className="text-xs p-3 bg-[var(--bg-paper-back)] rounded-xl border border-[var(--color-lines)] flex items-start justify-between gap-4"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[var(--color-accent)] shrink-0">@{log.username}</span>
                        <span className="text-[var(--color-text-muted)]">·</span>
                        <span className="text-[var(--color-text)] truncate">{log.action}</span>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] text-center py-8">No audit events recorded.</p>
                  )}
                </div>
              </div>
            )}

            {/* ═══════ STORAGE TAB ═══════ */}
            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Total Encrypted Entries</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{storageStats.totalEntries}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">AES-256-GCM encrypted diary pages across all users</p>
                  </div>
                  <div className="bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Storage Backend</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">
                      {isSupabaseConfigured ? 'Supabase' : `${storageStats.storageKB.toFixed(1)} KB`}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {isSupabaseConfigured
                        ? 'PostgreSQL via Supabase — managed cloud storage'
                        : 'localStorage mock mode — browser only'}
                    </p>
                  </div>
                  <div className="bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Registered Users</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{storageStats.totalUsers}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{storageStats.activeUsers} active · {storageStats.suspendedUsers} suspended</p>
                  </div>
                  <div className="bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Audit Log Events</p>
                    <p className="text-3xl font-extrabold text-[var(--color-text)] mt-1">{storageStats.totalLogs}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Total tracked system events</p>
                  </div>
                </div>

                <div className="bg-[var(--bg-paper)] p-5 rounded-2xl border border-[var(--color-lines)] shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider mb-3">Security Architecture</p>
                  <div className="space-y-2 text-xs text-[var(--color-text)]">
                    {[
                      'End-to-end encryption: AES-256-GCM per entry',
                      'Master key derived via PBKDF2 (SHA-256, 100k iterations)',
                      'Master key wrapped with user diary password',
                      'Recovery key wrapped with secret answer',
                      'Zero knowledge: server never sees plaintext content',
                      'Diary lockout after 5 failed attempts (60s cooldown)',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2 p-2.5 bg-[var(--bg-paper-back)] rounded-lg border border-[var(--color-lines)]">
                        <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
      {/* User Diary Viewer Side Panel */}
      <AnimatePresence>
        {viewingUser && (
          <UserDiaryViewer user={viewingUser} onClose={() => setViewingUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
