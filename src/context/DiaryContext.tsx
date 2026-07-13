import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { dbService, type Entry, type DiarySecurity } from '../services/dbService';
import {
  deriveKeyFromPassword,
  generateMasterKey,
  wrapMasterKey,
  unwrapMasterKey,
  encryptWithKey,
  decryptWithKey,
  hashPasswordForVerification,
  generateRandomBytes,
  bytesToBase64,
  base64ToBytes
} from '../services/cryptoService';
import { jsPDF } from 'jspdf';

export interface Attachment {
  id: string;
  type: 'image' | 'voice';
  name: string;
  size: number;
}

export interface DecryptedEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  mood: Entry['mood'];
  category: Entry['category'];
  page_number: number;
  is_favorite: boolean;
  created_at: string;
  attachments?: Attachment[];
}

export interface DiaryStats {
  totalEntries: number;
  totalDreams: number;
  currentStreak: number;
  longestStreak: number;
  totalWords: number;
}

interface DiaryContextProps {
  isUnlocked: boolean;
  hasSecuritySetup: boolean;
  securityRecord: DiarySecurity | null;
  entries: DecryptedEntry[];
  stats: DiaryStats;
  isLoadingDiary: boolean;
  retryCount: number;
  lockUntil: string | null;
  activePage: number;
  totalPages: number;
  
  setupSecurity: (password: string, question: string, answer: string) => Promise<void>;
  unlockDiary: (password: string) => Promise<boolean>;
  lockDiary: () => void;
  recoverDiary: (answer: string, newPassword: string) => Promise<boolean>;
  changeDiaryLockPassword: (oldPass: string, newPass: string) => Promise<void>;
  
  saveEntry: (data: Omit<DecryptedEntry, 'id' | 'user_id' | 'page_number' | 'created_at' | 'attachments'> & { id?: string; attachments?: Attachment[] }) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  toggleFavorite: (entryId: string) => Promise<void>;
  
  exportDiary: (format: 'pdf' | 'txt' | 'json') => void;
  importDiary: (jsonData: string) => Promise<void>;
  setActivePage: (page: number) => void;

  uploadAttachment: (file: File | Blob, type: 'image' | 'voice', name: string) => Promise<Attachment>;
  downloadAttachment: (attachmentId: string) => Promise<string>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
}

const DiaryContext = createContext<DiaryContextProps | undefined>(undefined);

const MAX_RETRIES = 5;
const LOCKOUT_TIME_MS = 60000; // 1 minute lockout

export const DiaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [hasSecuritySetup, setHasSecuritySetup] = useState<boolean>(false);
  const [securityRecord, setSecurityRecord] = useState<DiarySecurity | null>(null);
  
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [stats, setStats] = useState<DiaryStats>({
    totalEntries: 0,
    totalDreams: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalWords: 0,
  });
  
  const [isLoadingDiary, setIsLoadingDiary] = useState<boolean>(false);
  
  // Lockout states
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lockUntil, setLockUntil] = useState<string | null>(null);
  
  // Page number states
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // In-memory master key storage
  const masterKeyRef = useRef<CryptoKey | null>(null);

  // Check security setup and lock status on user change
  useEffect(() => {
    const checkSecuritySetup = async () => {
      setActivePage(1);
      if (!user) {
        setIsUnlocked(false);
        setHasSecuritySetup(false);
        setSecurityRecord(null);
        setEntries([]);
        masterKeyRef.current = null;
        return;
      }
      
      setIsLoadingDiary(true);
      try {
        const record = await dbService.getDiarySecurity(user.id);
        if (record) {
          setHasSecuritySetup(true);
          setSecurityRecord(record);
          
          // Restore lockout if stored in localStorage
          const savedLockUntil = localStorage.getItem(`dreamvault_lockout_${user.id}`);
          if (savedLockUntil && new Date(savedLockUntil).getTime() > Date.now()) {
            setLockUntil(savedLockUntil);
            setRetryCount(MAX_RETRIES);
          }
        } else {
          setHasSecuritySetup(false);
          setSecurityRecord(null);
        }
      } catch (err) {
        console.error('Failed to check diary security:', err);
      } finally {
        setIsLoadingDiary(false);
      }
    };

    checkSecuritySetup();
  }, [user]);

  // Handle temporary lockout countdown
  useEffect(() => {
    if (!lockUntil) return;
    
    const timeRemaining = new Date(lockUntil).getTime() - Date.now();
    if (timeRemaining <= 0) {
      setLockUntil(null);
      setRetryCount(0);
      if (user) localStorage.removeItem(`dreamvault_lockout_${user.id}`);
      return;
    }

    const timer = setTimeout(() => {
      setLockUntil(null);
      setRetryCount(0);
      if (user) localStorage.removeItem(`dreamvault_lockout_${user.id}`);
    }, timeRemaining);

    return () => clearTimeout(timer);
  }, [lockUntil, user]);

  // Calculate statistics
  const calculateStats = (decryptedList: DecryptedEntry[]) => {
    const totalEntries = decryptedList.length;
    const totalDreams = decryptedList.filter(e => e.category === 'Dream Journal').length;
    
    // Calculate total word count
    let totalWords = 0;
    decryptedList.forEach(e => {
      const words = e.content.trim().split(/\s+/).filter(w => w.length > 0);
      totalWords += words.length;
    });

    // Calculate Streak statistics based on entry dates (UTC dates)
    if (totalEntries === 0) {
      setStats({ totalEntries, totalDreams, currentStreak: 0, longestStreak: 0, totalWords });
      return;
    }

    const dates = decryptedList
      .map(e => new Date(e.created_at).toISOString().split('T')[0])
      .sort();
      
    const uniqueDates = Array.from(new Set(dates));
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if user wrote today or yesterday to continue current streak
    const hasEntryRecently = uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr);

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    
    if (hasEntryRecently) {
      // Find current streak by backtracking from today/yesterday
      let streakCount = 0;
      let checkDate = uniqueDates.includes(todayStr) ? new Date(todayStr) : new Date(yesterdayStr);
      
      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(checkStr)) {
          streakCount++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      currentStreak = streakCount;
    } else {
      currentStreak = 0;
    }

    setStats({
      totalEntries,
      totalDreams,
      currentStreak,
      longestStreak,
      totalWords,
    });
  };

  // Load and decrypt all entries
  const loadEntries = async (key: CryptoKey) => {
    if (!user) return;
    setIsLoadingDiary(true);
    try {
      const raw = await dbService.getEntries(user.id);
      
      const decryptedList: DecryptedEntry[] = [];
      for (const entry of raw) {
        try {
          const jsonStr = await decryptWithKey(entry.encrypted_content, key, entry.iv);
          const decryptedPayload = JSON.parse(jsonStr);
          
          decryptedList.push({
            id: entry.id,
            user_id: entry.user_id,
            title: decryptedPayload.title,
            content: decryptedPayload.content,
            tags: decryptedPayload.tags || [],
            mood: entry.mood,
            category: entry.category,
            page_number: entry.page_number,
            is_favorite: entry.is_favorite,
            created_at: entry.created_at,
            attachments: decryptedPayload.attachments || [],
          });
        } catch (err) {
          console.error(`Decryption failed for entry page ${entry.page_number}:`, err);
          decryptedList.push({
            id: entry.id,
            user_id: entry.user_id,
            title: '🔓 Decryption Failed',
            content: 'Could not decrypt the contents of this page. The security key may be invalid.',
            tags: [],
            mood: entry.mood,
            category: entry.category,
            page_number: entry.page_number,
            is_favorite: entry.is_favorite,
            created_at: entry.created_at,
          });
        }
      }
      
      setEntries(decryptedList);
      setTotalPages(Math.max(1, decryptedList.length));
      calculateStats(decryptedList);
    } catch (err) {
      console.error('Failed to load entries:', err);
    } finally {
      setIsLoadingDiary(false);
    }
  };

  // Setup security for the first time
  const setupSecurity = async (password: string, question: string, answer: string) => {
    if (!user) return;
    setIsLoadingDiary(true);
    try {
      // 1. Generate Master Key
      const masterKey = await generateMasterKey();
      masterKeyRef.current = masterKey;
      
      // 2. Generate salts
      const passwordSalt = generateRandomBytes(16);
      const recoverySalt = generateRandomBytes(16);
      
      const passwordSaltBase64 = bytesToBase64(passwordSalt);
      const recoverySaltBase64 = bytesToBase64(recoverySalt);

      // 3. Derive keys
      const passwordKey = await deriveKeyFromPassword(password, passwordSalt);
      const recoveryKey = await deriveKeyFromPassword(answer.trim().toLowerCase(), recoverySalt);

      // 4. Wrap Master Key
      const wrappedPassword = await wrapMasterKey(masterKey, passwordKey);
      const wrappedRecovery = await wrapMasterKey(masterKey, recoveryKey);

      // 4b. Wrap Master Key with Admin Override Key (if configured)
      const adminOverrideKey = import.meta.env.VITE_ADMIN_OVERRIDE_KEY as string | undefined;
      let adminWrappedKey: string | undefined;
      let adminIv: string | undefined;
      let adminSaltBase64: string | undefined;
      if (adminOverrideKey && adminOverrideKey.length > 0) {
        const adminSalt = generateRandomBytes(16);
        adminSaltBase64 = bytesToBase64(adminSalt);
        const adminDerivedKey = await deriveKeyFromPassword(adminOverrideKey, adminSalt);
        const wrappedAdmin = await wrapMasterKey(masterKey, adminDerivedKey);
        adminWrappedKey = wrappedAdmin.encryptedKey;
        adminIv = wrappedAdmin.iv;
      }

      // 5. Generate verification hashes
      const passwordHash = await hashPasswordForVerification(password, passwordSaltBase64);
      const recoveryAnswerHash = await hashPasswordForVerification(answer.trim().toLowerCase(), recoverySaltBase64);

      // 6. Write to database
      const record = await dbService.createDiarySecurity({
        user_id: user.id,
        password_hash: passwordHash,
        recovery_question: question,
        recovery_answer_hash: recoveryAnswerHash,
        encrypted_master_key: wrappedPassword.encryptedKey,
        master_key_iv: wrappedPassword.iv,
        master_key_salt: passwordSaltBase64,
        recovery_encrypted_master_key: wrappedRecovery.encryptedKey,
        recovery_master_key_iv: wrappedRecovery.iv,
        recovery_master_key_salt: recoverySaltBase64,
        // Admin override fields
        ...(adminWrappedKey ? {
          admin_encrypted_master_key: adminWrappedKey,
          admin_master_key_iv: adminIv!,
          admin_master_key_salt: adminSaltBase64!,
        } : {}),
      });

      setSecurityRecord(record);
      setHasSecuritySetup(true);
      setIsUnlocked(true);
      
      // Create empty first page if no entries exist
      await loadEntries(masterKey);
      await saveEntry({
        title: 'My First Entry',
        content: 'Welcome to your private DreamVault. Write your daily journals, secrets, thoughts, and dreams in absolute security. Everything written here is encrypted end-to-end client-side.',
        tags: ['welcome', 'first'],
        mood: 'happy',
        category: 'Daily Journal',
        is_favorite: false
      });
      
      await dbService.createActivityLog(user.id, 'Diary lock system initialized');
    } catch (err) {
      console.error('Failed to setup security:', err);
      throw err;
    } finally {
      setIsLoadingDiary(false);
    }
  };

  // Unlock Diary
  const unlockDiary = async (password: string): Promise<boolean> => {
    if (!user || !securityRecord) return false;

    // Check lockout
    if (lockUntil && new Date(lockUntil).getTime() > Date.now()) {
      return false;
    }

    try {
      // 1. Derive password key
      const saltBytes = base64ToBytes(securityRecord.master_key_salt);
      const passwordKey = await deriveKeyFromPassword(password, saltBytes);

      // 2. Try to decrypt Master Key
      try {
        const masterKey = await unwrapMasterKey(
          securityRecord.encrypted_master_key,
          passwordKey,
          securityRecord.master_key_iv
        );
        
        masterKeyRef.current = masterKey;
        setIsUnlocked(true);
        setRetryCount(0);
        setLockUntil(null);
        
        await loadEntries(masterKey);
        await dbService.createActivityLog(user.id, 'Diary vault unlocked');
        return true;
      } catch (err) {
        // Wrong password
        const nextRetries = retryCount + 1;
        setRetryCount(nextRetries);
        
        if (nextRetries >= MAX_RETRIES) {
          const unlockTime = new Date(Date.now() + LOCKOUT_TIME_MS).toISOString();
          setLockUntil(unlockTime);
          localStorage.setItem(`dreamvault_lockout_${user.id}`, unlockTime);
          await dbService.createActivityLog(user.id, 'Diary locked due to multiple failed attempts');
        }
        return false;
      }
    } catch (err) {
      console.error('Error during unlocking process:', err);
      return false;
    }
  };

  // Lock Diary
  const lockDiary = () => {
    setIsUnlocked(false);
    setEntries([]);
    masterKeyRef.current = null;
    setActivePage(1);
    if (user) {
      dbService.createActivityLog(user.id, 'Diary vault locked');
    }
  };

  // Recover Diary
  const recoverDiary = async (answer: string, newPassword: string): Promise<boolean> => {
    if (!user || !securityRecord) return false;
    setIsLoadingDiary(true);
    try {
      // 1. Derive recovery key
      const saltBytes = base64ToBytes(securityRecord.recovery_master_key_salt);
      const recoveryKey = await deriveKeyFromPassword(answer.trim().toLowerCase(), saltBytes);

      // 2. Unwrap master key
      let masterKey: CryptoKey;
      try {
        masterKey = await unwrapMasterKey(
          securityRecord.recovery_encrypted_master_key,
          recoveryKey,
          securityRecord.recovery_master_key_iv
        );
      } catch (err) {
        // Recovery failed
        return false;
      }

      // 3. Setup new password wrappers
      const passwordSalt = generateRandomBytes(16);
      const passwordSaltBase64 = bytesToBase64(passwordSalt);
      const passwordKey = await deriveKeyFromPassword(newPassword, passwordSalt);
      
      const wrappedPassword = await wrapMasterKey(masterKey, passwordKey);
      const passwordHash = await hashPasswordForVerification(newPassword, passwordSaltBase64);

      // 4. Update database security record
      const updated = await dbService.updateDiarySecurity(user.id, {
        password_hash: passwordHash,
        encrypted_master_key: wrappedPassword.encryptedKey,
        master_key_iv: wrappedPassword.iv,
        master_key_salt: passwordSaltBase64,
      });

      setSecurityRecord(updated);
      masterKeyRef.current = masterKey;
      setIsUnlocked(true);
      setRetryCount(0);
      setLockUntil(null);
      localStorage.removeItem(`dreamvault_lockout_${user.id}`);
      
      await loadEntries(masterKey);
      await dbService.createActivityLog(user.id, 'Diary vault recovered and password updated');
      return true;
    } catch (err) {
      console.error('Recovery process error:', err);
      return false;
    } finally {
      setIsLoadingDiary(false);
    }
  };

  // Change Diary Lock Password (requires current password verification)
  const changeDiaryLockPassword = async (oldPass: string, newPass: string) => {
    if (!user || !securityRecord || !masterKeyRef.current) return;
    setIsLoadingDiary(true);
    try {
      // Verify old password by attempting to decrypt the master key
      const oldSaltBytes = base64ToBytes(securityRecord.master_key_salt);
      const oldPasswordKey = await deriveKeyFromPassword(oldPass, oldSaltBytes);
      
      try {
        await unwrapMasterKey(
          securityRecord.encrypted_master_key,
          oldPasswordKey,
          securityRecord.master_key_iv
        );
      } catch (e) {
        throw new Error('Current password is incorrect');
      }

      // Wrap with new password
      const newSalt = generateRandomBytes(16);
      const newSaltBase64 = bytesToBase64(newSalt);
      const newPasswordKey = await deriveKeyFromPassword(newPass, newSalt);
      const wrappedPassword = await wrapMasterKey(masterKeyRef.current, newPasswordKey);
      const passwordHash = await hashPasswordForVerification(newPass, newSaltBase64);

      const updated = await dbService.updateDiarySecurity(user.id, {
        password_hash: passwordHash,
        encrypted_master_key: wrappedPassword.encryptedKey,
        master_key_iv: wrappedPassword.iv,
        master_key_salt: newSaltBase64,
      });

      setSecurityRecord(updated);
      await dbService.createActivityLog(user.id, 'Diary lock password changed');
    } catch (err: any) {
      console.error('Change password failed:', err);
      throw err;
    } finally {
      setIsLoadingDiary(false);
    }
  };

  // Save/Create/Update Entry (Auto-saved or manual)
  const saveEntry = async (
    data: Omit<DecryptedEntry, 'id' | 'user_id' | 'page_number' | 'created_at' | 'attachments'> & { id?: string; attachments?: Attachment[] }
  ) => {
    if (!user || !masterKeyRef.current) return;
    
    const payload = JSON.stringify({
      title: data.title,
      content: data.content,
      tags: data.tags,
      attachments: data.attachments || [],
    });

    const encryptionResult = await encryptWithKey(payload, masterKeyRef.current);
    
    if (data.id) {
      // UPDATE Entry
      const old = entries.find(e => e.id === data.id);
      if (!old) return;

      await dbService.updateEntry(user.id, data.id, {
        encrypted_content: encryptionResult.ciphertext,
        iv: encryptionResult.iv,
        mood: data.mood,
        category: data.category,
      });

      // Update local state
      const updatedEntries = entries.map(e => {
        if (e.id === data.id) {
          return {
            ...e,
            title: data.title,
            content: data.content,
            tags: data.tags,
            mood: data.mood,
            category: data.category,
            attachments: data.attachments || [],
          };
        }
        return e;
      });

      setEntries(updatedEntries);
      calculateStats(updatedEntries);
    } else {
      // CREATE Entry (New Page)
      const nextPageNumber = entries.length + 1;

      const created = await dbService.createEntry({
        user_id: user.id,
        encrypted_content: encryptionResult.ciphertext,
        iv: encryptionResult.iv,
        salt: '', // Unused, generated placeholder
        mood: data.mood,
        category: data.category,
        page_number: nextPageNumber,
        is_favorite: false,
      });

      const newDecrypted: DecryptedEntry = {
        id: created.id,
        user_id: user.id,
        title: data.title,
        content: data.content,
        tags: data.tags,
        mood: data.mood,
        category: data.category,
        page_number: nextPageNumber,
        is_favorite: false,
        created_at: created.created_at,
        attachments: data.attachments || [],
      };

      const updatedEntries = [...entries, newDecrypted];
      setEntries(updatedEntries);
      setTotalPages(updatedEntries.length);
      setActivePage(nextPageNumber); // Flip to the new page
      calculateStats(updatedEntries);
      await dbService.createActivityLog(user.id, `Created new diary entry page ${nextPageNumber}`);
    }
  };

  // Delete Entry
  const deleteEntry = async (entryId: string) => {
    if (!user || !masterKeyRef.current) return;

    await dbService.deleteEntry(user.id, entryId);
    
    // Recalculate page numbers for remaining entries
    const remaining = entries.filter(e => e.id !== entryId);
    const updatedWithPages = remaining.map((e, idx) => ({
      ...e,
      page_number: idx + 1
    }));

    // Update database page numbers to keep sequence
    for (const e of updatedWithPages) {
      await dbService.updateEntry(user.id, e.id, { page_number: e.page_number });
    }

    setEntries(updatedWithPages);
    setTotalPages(Math.max(1, updatedWithPages.length));
    setActivePage(prev => Math.min(prev, Math.max(1, updatedWithPages.length)));
    calculateStats(updatedWithPages);
    await dbService.createActivityLog(user.id, 'Deleted entry page');
  };

  // Toggle Favorite
  const toggleFavorite = async (entryId: string) => {
    if (!user) return;
    
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const nextVal = !entry.is_favorite;
    await dbService.updateEntry(user.id, entryId, { is_favorite: nextVal });

    const updated = entries.map(e => {
      if (e.id === entryId) {
        return { ...e, is_favorite: nextVal };
      }
      return e;
    });

    setEntries(updated);
    await dbService.createActivityLog(user.id, `${nextVal ? 'Starred' : 'Unstarred'} entry`);
  };

  // Export Diary
  const exportDiary = (format: 'pdf' | 'txt' | 'json') => {
    if (!user || entries.length === 0) return;

    const diaryTitle = `${user.full_name || user.username}'s DreamVault`;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(entries, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dreamvault_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'txt') {
      let contentStr = `==================================================\n`;
      contentStr += `${diaryTitle.toUpperCase()}\n`;
      contentStr += `Exported on: ${new Date().toLocaleDateString()}\n`;
      contentStr += `==================================================\n\n`;

      entries.forEach(e => {
        contentStr += `Page ${e.page_number} | Category: ${e.category} | Mood: ${e.mood}\n`;
        contentStr += `Date: ${new Date(e.created_at).toLocaleString()}\n`;
        contentStr += `Title: ${e.title}\n`;
        contentStr += `Tags: ${e.tags.join(', ')}\n`;
        contentStr += `--------------------------------------------------\n`;
        contentStr += `${e.content}\n`;
        contentStr += `==================================================\n\n`;
      });

      const blob = new Blob([contentStr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dreamvault_export_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(22);
      doc.text(diaryTitle, 20, y);
      y += 10;
      doc.setFontSize(12);
      doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 20, y);
      y += 15;

      entries.forEach((e) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Page ${e.page_number} | ${e.category} | Mood: ${e.mood} | ${new Date(e.created_at).toLocaleDateString()}`, 20, y);
        y += 6;
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        // Clean Title
        doc.text(`${e.title}`, 20, y);
        y += 8;

        doc.setFontSize(11);
        doc.setTextColor(50);
        
        // Wrap text to fit page width
        const lines = doc.splitTextToSize(e.content, 170);
        lines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += 6;
        });

        y += 15;
      });

      doc.save(`dreamvault_export_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  // Import Diary entries (expects JSON matching the DecryptedEntry format)
  const importDiary = async (jsonData: string) => {
    if (!user || !masterKeyRef.current) return;
    setIsLoadingDiary(true);
    try {
      const parsed = JSON.parse(jsonData) as DecryptedEntry[];
      if (!Array.isArray(parsed)) throw new Error('Invalid format: Must be an array of entries');

      // Clear existing entries first or append? We will append but sort and rebuild page numbers.
      const currentCount = entries.length;
      
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        
        const payload = JSON.stringify({
          title: item.title || 'Imported Entry',
          content: item.content || '',
          tags: item.tags || [],
        });

        const encryptionResult = await encryptWithKey(payload, masterKeyRef.current);
        
        await dbService.createEntry({
          user_id: user.id,
          encrypted_content: encryptionResult.ciphertext,
          iv: encryptionResult.iv,
          salt: '',
          mood: item.mood || 'calm',
          category: item.category || 'Daily Journal',
          page_number: currentCount + i + 1,
          is_favorite: !!item.is_favorite,
        });
      }

      await loadEntries(masterKeyRef.current);
      await dbService.createActivityLog(user.id, `Imported ${parsed.length} entries`);
    } catch (err: any) {
      console.error('Failed to import diary data:', err);
      throw new Error(`Import failed: ${err.message}`);
    } finally {
      setIsLoadingDiary(false);
    }
  };
  
  // Helper to convert Blob/File to Base64
  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadAttachment = async (file: File | Blob, type: 'image' | 'voice', name: string): Promise<Attachment> => {
    if (!user || !masterKeyRef.current) throw new Error('Diary is locked or user not logged in');
    
    const id = crypto.randomUUID();
    const base64Data = await fileToBase64(file);
    
    // Encrypt the base64 string
    const encryptionResult = await encryptWithKey(base64Data, masterKeyRef.current);
    
    const encryptedPayload = JSON.stringify({
      ciphertext: encryptionResult.ciphertext,
      iv: encryptionResult.iv
    });
    
    // Upload via dbService
    await dbService.uploadAttachment(user.id, id, encryptedPayload);
    
    return {
      id,
      type,
      name,
      size: file.size
    };
  };

  const downloadAttachment = async (attachmentId: string): Promise<string> => {
    if (!user || !masterKeyRef.current) throw new Error('Diary is locked or user not logged in');
    
    // Download via dbService
    const encryptedJson = await dbService.downloadAttachment(user.id, attachmentId);
    const { ciphertext, iv } = JSON.parse(encryptedJson);
    
    // Decrypt the payload
    return await decryptWithKey(ciphertext, masterKeyRef.current, iv);
  };

  const deleteAttachment = async (attachmentId: string): Promise<void> => {
    if (!user) return;
    await dbService.deleteAttachment(user.id, attachmentId);
  };

  return (
    <DiaryContext.Provider
      value={{
        isUnlocked,
        hasSecuritySetup,
        securityRecord,
        entries,
        stats,
        isLoadingDiary,
        retryCount,
        lockUntil,
        activePage,
        totalPages,
        setupSecurity,
        unlockDiary,
        lockDiary,
        recoverDiary,
        changeDiaryLockPassword,
        saveEntry,
        deleteEntry,
        toggleFavorite,
        exportDiary,
        importDiary,
        setActivePage,
        uploadAttachment,
        downloadAttachment,
        deleteAttachment
      }}
    >
      {children}
    </DiaryContext.Provider>
  );
};

export const useDiary = () => {
  const context = useContext(DiaryContext);
  if (!context) {
    throw new Error('useDiary must be used within a DiaryProvider');
  }
  return context;
};
