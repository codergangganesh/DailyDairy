import React, { useState, useEffect } from 'react';
import { dbService, type Profile, type ActivityLog } from '../../services/dbService';
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
  ShieldCheck 
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user: adminUser } = useAuth();
  
  const [users, setUsers] = useState<Profile[]>([]);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'storage'>('users');
  const [storageStats, setStorageStats] = useState({ totalBytes: 0, entriesCount: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const allProfiles = await dbService.getAllProfiles();
      // Filter out admin user themselves so they don't suspend themselves
      setUsers(allProfiles);

      const allLogs = await dbService.getActivityLogs();
      setLogs(allLogs);

      // Compute simple LocalStorage storage stats
      const entriesStr = localStorage.getItem('dreamvault_entries') || '[]';
      const securityStr = localStorage.getItem('dreamvault_security') || '[]';
      const profilesStr = localStorage.getItem('dreamvault_profiles') || '[]';
      
      const totalBytes = entriesStr.length + securityStr.length + profilesStr.length;
      const parsedEntries = JSON.parse(entriesStr);

      setStorageStats({
        totalBytes,
        entriesCount: parsedEntries.length
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
    const nextSuspendedState = !user.suspended;
    const actionStr = nextSuspendedState ? 'suspended' : 'unsuspended';
    
    if (!window.confirm(`Are you sure you want to ${actionStr} user @${user.username}?`)) {
      return;
    }

    try {
      await dbService.updateProfile(user.id, { suspended: nextSuspendedState });
      
      // Log admin activity
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin ${actionStr} user @${user.username}`);
      }
      
      // Reload lists
      loadData();
    } catch (err) {
      alert('Failed to update suspension status');
    }
  };

  const handleClearLockout = async (userId: string, username: string) => {
    if (!window.confirm(`Clear password lockout and reset retry limits for user @${username}?`)) {
      return;
    }

    try {
      localStorage.removeItem(`dreamvault_lockout_${userId}`);
      
      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin cleared lockouts for @${username}`);
      }
      
      alert('Lockout retry limits cleared. User can try their diary password again.');
      loadData();
    } catch (err) {
      alert('Failed to clear lockout');
    }
  };

  const handleHardResetDiary = async (userId: string, username: string) => {
    const confirm1 = window.confirm(`WARNING: Resetting the E2E lock for user @${username} will DELETE all their E2E encrypted entries, as the Master Key wrapping cannot be broken. Proceed?`);
    if (!confirm1) return;

    const confirm2 = window.confirm(`Type "confirm reset" to completely wipe @${username}'s diary security and entry database record.`);
    if (!confirm2) return;

    try {
      // 1. Delete security record
      const securityList = JSON.parse(localStorage.getItem('dreamvault_security') || '[]');
      const filteredSec = securityList.filter((s: any) => s.user_id !== userId);
      localStorage.setItem('dreamvault_security', JSON.stringify(filteredSec));

      // 2. Delete entries
      const entries = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]');
      const filteredEntries = entries.filter((e: any) => e.user_id !== userId);
      localStorage.setItem('dreamvault_entries', JSON.stringify(filteredEntries));

      // 3. Clear local lockouts
      localStorage.removeItem(`dreamvault_lockout_${userId}`);

      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin executed diary hard reset for @${username}`);
      }

      alert(`Diary lock has been reset for @${username}. All old entries deleted. User can configure a new diary lock on their next login.`);
      loadData();
    } catch (err) {
      alert('Failed to reset diary lock');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Permanently DELETE user account @${username} and all their records? This cannot be undone.`)) {
      return;
    }

    try {
      // 1. Delete profile and entries
      const profiles = JSON.parse(localStorage.getItem('dreamvault_profiles') || '[]');
      const updatedProfiles = profiles.filter((p: any) => p.id !== userId);
      localStorage.setItem('dreamvault_profiles', JSON.stringify(updatedProfiles));

      const entries = JSON.parse(localStorage.getItem('dreamvault_entries') || '[]');
      const updatedEntries = entries.filter((e: any) => e.user_id !== userId);
      localStorage.setItem('dreamvault_entries', JSON.stringify(updatedEntries));

      const security = JSON.parse(localStorage.getItem('dreamvault_security') || '[]');
      const updatedSec = security.filter((s: any) => s.user_id !== userId);
      localStorage.setItem('dreamvault_security', JSON.stringify(updatedSec));

      // 2. Delete auth credentials
      const authUsers = JSON.parse(localStorage.getItem('dreamvault_mock_auth_users') || '[]');
      const updatedAuth = authUsers.filter((u: any) => u.id !== userId);
      localStorage.setItem('dreamvault_mock_auth_users', JSON.stringify(updatedAuth));

      if (adminUser) {
        await dbService.createActivityLog(adminUser.id, `Admin deleted user account @${username}`);
      }

      alert(`User account @${username} deleted.`);
      loadData();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 select-none">
      
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-paper)] p-6 rounded-2xl border border-[var(--color-lines)] shadow-sm">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text)]">
            <ShieldCheck className="w-6 h-6 text-[var(--color-accent)]" />
            Admin Dashboard Panel
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Logged in as Admin: <span className="font-semibold">{adminUser?.full_name}</span> (@{adminUser?.username})
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--bg-paper-back)] hover:bg-[var(--bg-paper)] text-[var(--color-text)] text-xs font-bold rounded-lg border border-[var(--color-lines)] transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Panel
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-[var(--color-lines)] gap-1.5">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer
            ${activeTab === 'users'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
        >
          <Users className="w-4 h-4" />
          User Management ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer
            ${activeTab === 'logs'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
        >
          <Activity className="w-4 h-4" />
          Audit Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer
            ${activeTab === 'storage'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
        >
          <Database className="w-4 h-4" />
          Database Storage
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="text-center py-12 text-[var(--color-text-muted)] bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--color-accent)] mb-2" />
          <p className="text-xs">Processing data...</p>
        </div>
      )}

      {/* ================= USERS TAB ================= */}
      {!loading && activeTab === 'users' && (
        <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-paper-back)] border-b border-[var(--color-lines)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                  <th className="p-4">User</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Joined Date</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-lines)]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--bg-paper-back)]/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <img
                          src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                          className="w-7 h-7 rounded-full bg-[var(--bg-paper-back)] border border-[var(--color-lines)]"
                          alt="avatar"
                        />
                        <div>
                          <p className="font-bold text-[var(--color-text)]">{u.full_name || 'N/A'}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">ID: {u.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-[var(--color-text)]">@{u.username}</td>
                    <td className="p-4 text-[var(--color-text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        u.role === 'admin' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-[var(--bg-paper-back)] text-[var(--color-text)] border border-[var(--color-lines)]'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        u.suspended ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'
                      }`}>
                        {u.suspended ? 'SUSPENDED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      {u.role !== 'admin' && (
                        <>
                          {/* Suspend/Unsuspend Button */}
                          <button
                            onClick={() => handleToggleSuspend(u)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              u.suspended
                                ? 'border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                : 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            }`}
                            title={u.suspended ? 'Unsuspend User' : 'Suspend User'}
                          >
                            {u.suspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>

                          {/* Clear Lockout */}
                          <button
                            onClick={() => handleClearLockout(u.id, u.username)}
                            className="p-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:bg-[var(--bg-paper)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
                            title="Clear Lockout (Reset retry limit)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Hard Reset Lock */}
                          <button
                            onClick={() => handleHardResetDiary(u.id, u.username)}
                            className="p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition cursor-pointer"
                            title="Reset Diary Lock Password (Wipes entries)"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= LOGS TAB ================= */}
      {!loading && activeTab === 'logs' && (
        <div className="bg-[var(--bg-paper)] rounded-2xl border border-[var(--color-lines)] shadow-sm p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1 border-b border-[var(--color-lines)] pb-2">
            <Activity className="w-4 h-4 text-[var(--color-accent)]" />
            System Audit Log
          </h3>
          <div className="max-h-[400px] overflow-y-auto pr-1 space-y-2">
            {logs.map(log => (
              <div key={log.id} className="text-xs p-3 bg-[var(--bg-paper-back)] rounded-xl border border-[var(--color-lines)] flex items-start justify-between gap-4">
                <div>
                  <span className="font-bold text-[var(--color-text)]">
                    @{log.username}
                  </span>
                  <span className="text-[var(--color-text-muted)]/50 mx-2">|</span>
                  <span className="text-[var(--color-text)] font-medium">{log.action}</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No audit activities recorded.</p>
            )}
          </div>
        </div>
      )}

      {/* ================= STORAGE TAB ================= */}
      {!loading && activeTab === 'storage' && (
        <div className="bg-[var(--bg-paper)] p-6 rounded-2xl border border-[var(--color-lines)] shadow-sm space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1 border-b border-[var(--color-lines)] pb-2">
            <Database className="w-4.5 h-4.5 text-[var(--color-accent)]" />
            Database & LocalStorage Metrics
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-paper-back)] p-4 rounded-xl border border-[var(--color-lines)]">
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Entries Count</h4>
              <p className="text-2xl font-extrabold text-[var(--color-text)] mt-1">
                {storageStats.entriesCount} pages
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]/80 mt-1">Total E2E encrypted entries stored.</p>
            </div>
            <div className="bg-[var(--bg-paper-back)] p-4 rounded-xl border border-[var(--color-lines)]">
              <h4 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Storage Utilized</h4>
              <p className="text-2xl font-extrabold text-[var(--color-text)] mt-1">
                {(storageStats.totalBytes / 1024).toFixed(2)} KB
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]/80 mt-1">Database string character payload length.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
