/**
 * SyncContext.tsx
 * Provides offline / sync state to the whole app.
 *
 * Exposes:
 *  - isOnline       — real-time network status
 *  - syncStatus     — idle | syncing | success | error | offline
 *  - pendingCount   — number of unsynced mutations in the outbox
 *  - lastSyncedAt   — ISO string of last successful sync
 *  - manualSync()   — trigger a sync manually (from Settings UI)
 *  - pwaInstall     — BeforeInstallPromptEvent (if available)
 *  - promptInstall()— show the native "Add to Home Screen" prompt
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
  syncOutbox,
  pullRemoteEntries,
  pullRemoteSecurity,
  onSyncComplete,
  registerOnlineListener,
  type SyncStatus,
} from '../services/syncService';
import { outboxCount } from '../services/offlineDB';

interface SyncContextProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  manualSync: () => Promise<void>;
  pwaInstallable: boolean;
  promptInstall: () => Promise<void>;
}

const SyncContext = createContext<SyncContextProps | undefined>(undefined);

// Capture the BeforeInstallPromptEvent before React mounts
let _deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

// Extend the global Window type for the non-standard event
declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    prompt(): Promise<void>;
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pwaInstallable, setPwaInstallable] = useState(false);

  const syncingRef = useRef(false);

  // Track online / offline
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => { setIsOnline(false); setSyncStatus('offline'); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Detect PWA installability
  useEffect(() => {
    if (_deferredInstallPrompt) setPwaInstallable(true);

    const handleBIPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      _deferredInstallPrompt = e;
      setPwaInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBIPrompt);

    window.addEventListener('appinstalled', () => {
      setPwaInstallable(false);
      _deferredInstallPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBIPrompt);
    };
  }, []);

  // Subscribe to sync completion events
  useEffect(() => {
    const unsub = onSyncComplete((result) => {
      setSyncStatus(result.status);
      refreshPendingCount();
      if (result.status === 'success') {
        setLastSyncedAt(new Date().toISOString());
      }
    });
    return unsub;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register the window online listener once
  useEffect(() => {
    registerOnlineListener(() => user?.id ?? null);
  }, [user]);

  // Refresh pending count whenever user or sync state changes
  const refreshPendingCount = useCallback(async () => {
    if (!user) { setPendingCount(0); return; }
    const n = await outboxCount(user.id);
    setPendingCount(n);
  }, [user]);

  // On user login: pull remote data into IDB, then sync outbox
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setPendingCount(0);
      return;
    }

    (async () => {
      await refreshPendingCount();

      if (navigator.onLine) {
        setSyncStatus('syncing');
        await pullRemoteSecurity(user.id);
        await pullRemoteEntries(user.id);
        await syncOutbox(user.id);
        setLastSyncedAt(new Date().toISOString());
      }
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const manualSync = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await syncOutbox(user.id);
    } finally {
      syncingRef.current = false;
      await refreshPendingCount();
    }
  }, [user, refreshPendingCount]);

  const promptInstall = useCallback(async () => {
    if (!_deferredInstallPrompt) return;
    await _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      setPwaInstallable(false);
      _deferredInstallPrompt = null;
    }
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncStatus,
        pendingCount,
        lastSyncedAt,
        manualSync,
        pwaInstallable,
        promptInstall,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextProps => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
};
