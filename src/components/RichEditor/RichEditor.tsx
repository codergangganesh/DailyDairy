import React, { useState, useEffect, useRef } from 'react';
import { useDiary, type DecryptedEntry, type Attachment } from '../../context/DiaryContext';
import { Eye, Edit2, Save, Trash2, Tag, BookOpen, Smile, AlertTriangle, Camera, Mic, Loader2, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceRecorder } from '../VoiceRecorder/VoiceRecorder';

interface RichEditorProps {
  entry?: DecryptedEntry; // If provided, we are editing. Otherwise creating.
  onSaveSuccess?: () => void;
  onCancel?: () => void;
}

export const RichEditor: React.FC<RichEditorProps> = ({ entry, onSaveSuccess, onCancel }) => {
  const { saveEntry, deleteEntry, uploadAttachment, downloadAttachment, deleteAttachment } = useDiary();
  
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [mood, setMood] = useState<DecryptedEntry['mood']>(entry?.mood || 'happy');
  const [category, setCategory] = useState<DecryptedEntry['category']>(entry?.category || 'Daily Journal');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  
  const [isPreview, setIsPreview] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveMsg, setAutoSaveMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTitleWarning, setShowTitleWarning] = useState(false);

  // E2E Attachments states
  const [attachments, setAttachments] = useState<Attachment[]>(entry?.attachments || []);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [decryptedUrls, setDecryptedUrls] = useState<Record<string, string>>({});
  
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Decrypt attachments when entry changes
  useEffect(() => {
    let active = true;
    const loadAttachments = async () => {
      if (!entry?.attachments || entry.attachments.length === 0) return;
      
      const urls: Record<string, string> = {};
      for (const att of entry.attachments) {
        try {
          const decryptedBase64 = await downloadAttachment(att.id);
          if (active) {
            urls[att.id] = decryptedBase64;
          }
        } catch (e) {
          console.error(`Failed to download/decrypt attachment ${att.id}:`, e);
        }
      }
      if (active) {
        setDecryptedUrls(urls);
      }
    };

    loadAttachments();
    return () => {
      active = false;
    };
  }, [entry, downloadAttachment]);


  // Compute counters
  useEffect(() => {
    setCharCount(content.length);
    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
  }, [content]);

  // Load draft from localStorage if creating a new entry
  useEffect(() => {
    if (!entry) {
      const savedDraft = localStorage.getItem('dreamvault_draft');
      if (savedDraft) {
        try {
          const { draftTitle, draftContent, draftMood, draftCategory, draftTags } = JSON.parse(savedDraft);
          setTitle(draftTitle || '');
          setContent(draftContent || '');
          setMood(draftMood || 'happy');
          setCategory(draftCategory || 'Daily Journal');
          setTags(draftTags || []);
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      }
    }
  }, [entry]);

  // Autosave draft to local storage (only for new entries)
  useEffect(() => {
    if (entry) return; // Don't autosave draft over existing entries

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      const draft = {
        draftTitle: title,
        draftContent: content,
        draftMood: mood,
        draftCategory: category,
        draftTags: tags,
      };
      localStorage.setItem('dreamvault_draft', JSON.stringify(draft));
      setAutoSaveMsg('Draft autosaved');
      setTimeout(() => setAutoSaveMsg(''), 2000);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, content, mood, category, tags, entry]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setShowTitleWarning(true);
      return;
    }
    setIsSaving(true);
    try {
      await saveEntry({
        id: entry?.id,
        title,
        content,
        mood,
        category,
        tags,
        is_favorite: entry?.is_favorite || false,
        attachments,
      });

      // Clear draft if it was a new entry
      if (!entry) {
        localStorage.removeItem('dreamvault_draft');
      }

      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!entry) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!entry) return;
    setIsSaving(true);
    try {
      await deleteEntry(entry.id);
      setShowDeleteConfirm(false);
      if (onCancel) onCancel();
    } catch (err) {
      console.error(err);
      alert('Failed to delete page');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setIsUploading(true);
    try {
      const newAtt = await uploadAttachment(file, 'image', file.name);
      setAttachments(prev => [...prev, newAtt]);
      
      // Update cache
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setDecryptedUrls(prev => ({ ...prev, [newAtt.id]: base64Data }));
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload encrypted image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceSave = async (audioBlob: Blob, name: string) => {
    setIsRecordingOpen(false);
    setIsUploading(true);
    try {
      const newAtt = await uploadAttachment(audioBlob, 'voice', name);
      setAttachments(prev => [...prev, newAtt]);
      
      const localUrl = URL.createObjectURL(audioBlob);
      setDecryptedUrls(prev => ({ ...prev, [newAtt.id]: localUrl }));
    } catch (err) {
      console.error('Failed to upload voice memo:', err);
      alert('Failed to save encrypted voice memo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async (attId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attId));
    try {
      await deleteAttachment(attId);
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  // Basic markdown parser
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="italic text-slate-400">Empty page...</p>;
    
    return text.split('\n').map((para, idx) => {
      // Headers
      if (para.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-bold mt-4 mb-2">{para.substring(2)}</h1>;
      }
      if (para.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold mt-3 mb-2">{para.substring(3)}</h2>;
      }
      if (para.startsWith('### ')) {
        return <h3 key={idx} className="text-lg font-bold mt-2 mb-1">{para.substring(4)}</h3>;
      }
      // Bullet list
      if (para.startsWith('- ') || para.startsWith('* ')) {
        return <li key={idx} className="list-disc ml-6">{para.substring(2)}</li>;
      }
      // Blockquotes
      if (para.startsWith('> ')) {
        return <blockquote key={idx} className="border-l-4 border-slate-300 pl-4 italic my-2">{para.substring(2)}</blockquote>;
      }
      
      // Bold & Italic markdown check
      let formattedHtml = para
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-200 dark:bg-slate-800 px-1 rounded">$1</code>');

      return <p key={idx} className="mb-2 min-h-[1.5rem]" dangerouslySetInnerHTML={{ __html: formattedHtml || '&nbsp;' }} />;
    });
  };

  const moodsList = [
    { value: 'happy', label: '😀 Happy' },
    { value: 'calm', label: '😌 Calm' },
    { value: 'sad', label: '😢 Sad' },
    { value: 'angry', label: '😡 Angry' },
    { value: 'tired', label: '😴 Tired' },
    { value: 'excited', label: '🤩 Excited' },
  ] as const;

  const categoriesList = [
    'Daily Journal',
    'Dream Journal',
    'Personal Notes',
    'Goals',
    'Memories',
    'Gratitude',
  ] as const;

  return (
    <div className="flex flex-col h-full bg-transparent max-w-xl mx-auto p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 border-b border-[var(--color-lines)] pb-2">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text)]">
          <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
          {entry ? `Edit Page ${entry.page_number}` : 'New Page'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:opacity-85 text-[var(--color-text)] transition cursor-pointer"
          >
            {isPreview ? <Edit2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {isPreview ? 'Write' : 'Preview'}
          </button>
          {entry && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
              title="Delete Page"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Fields */}
      {!isPreview ? (
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this page a title..."
            className="w-full text-xl font-bold bg-transparent border-b border-[var(--color-lines)] py-1 focus:outline-none focus:border-[var(--color-accent)] placeholder-[var(--color-text-muted)]/50 text-[var(--color-text)]"
          />

          {/* Grid Selection */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[var(--color-text-muted)] mb-1 font-medium flex items-center gap-1">
                <Smile className="w-3 h-3 text-[var(--color-accent)]" /> Mood
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as any)}
                className="w-full p-2 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] text-[var(--color-text)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              >
                {moodsList.map((m) => (
                  <option key={m.value} value={m.value} className="bg-[var(--bg-paper)] text-[var(--color-text)]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--color-text-muted)] mb-1 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full p-2 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] text-[var(--color-text)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat} className="bg-[var(--bg-paper)] text-[var(--color-text)]">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags entry */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium flex items-center gap-1">
              <Tag className="w-3 h-3 text-[var(--color-accent)]" /> Tags (Press comma or enter to add)
            </label>
            <div className="flex flex-wrap gap-1 p-2 bg-[var(--bg-paper-back)] border border-[var(--color-lines)] rounded-lg items-center">
              {tags.map((tag, idx) => (
                <span
                  key={tag}
                  className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(idx)}
                    className="hover:text-red-500 font-bold focus:outline-none cursor-pointer"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? 'e.g. dream, starry, happy' : ''}
                className="bg-transparent text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none flex-1 min-w-[80px]"
              />
            </div>
          </div>

          {/* Content Lined Notebook Area */}
          <div className="flex-1 flex flex-col relative min-h-[200px]">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your thoughts..."
              className="w-full flex-1 notebook-paper handwriting-target bg-transparent border-none focus:ring-0 focus:outline-none py-2 resize-none placeholder-[var(--color-text-muted)]/50 text-[var(--color-text)] overflow-y-auto"
            />
          </div>

          {/* E2E Encrypted Attachments Area */}
          <div className="border-t border-[var(--color-lines)] pt-3 mt-2 space-y-3">
            {/* Attachment Controls */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Attachments
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:opacity-85 text-[var(--color-text)] transition font-bold cursor-pointer disabled:opacity-50 min-h-[32px]"
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  Add Image
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecordingOpen(true)}
                  disabled={isUploading}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--color-lines)] bg-[var(--bg-paper-back)] hover:opacity-85 text-[var(--color-text)] transition font-bold cursor-pointer disabled:opacity-50 min-h-[32px]"
                >
                  <Mic className="w-3 h-3" />
                  Record Voice
                </button>
              </div>
            </div>

            {/* Hidden inputs */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={imageInputRef}
              onChange={handleImageSelect}
            />

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {attachments.map((att) => {
                  const url = decryptedUrls[att.id];
                  return (
                    <div key={att.id} className="relative group bg-[var(--bg-paper-back)] p-2.5 rounded-xl border border-[var(--color-lines)] flex flex-col justify-between min-h-[100px] overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="absolute right-1.5 top-1.5 p-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition z-10 cursor-pointer"
                        title="Delete Attachment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {att.type === 'image' ? (
                        <div className="flex-1 flex flex-col justify-between">
                          {url ? (
                            <img src={url} alt={att.name} className="w-full h-16 object-cover rounded-lg border border-[var(--color-lines)] shadow-inner" />
                          ) : (
                            <div className="w-full h-16 bg-[var(--bg-paper)] rounded-lg flex items-center justify-center border border-[var(--color-lines)]">
                              <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
                            </div>
                          )}
                          <span className="text-[9px] text-[var(--color-text-muted)] truncate block mt-1.5 font-mono">{att.name}</span>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5 bg-[var(--bg-paper)] p-1.5 rounded-lg border border-[var(--color-lines)] mt-4">
                            {url ? (
                              <audio src={url} controls className="w-full h-6 scale-90 origin-left" />
                            ) : (
                              <div className="w-full flex items-center justify-center py-1">
                                <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-[var(--color-text-muted)] truncate block mt-1.5 font-mono">{att.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Markdown Preview Page */
        <div className="flex-1 flex flex-col p-2 overflow-y-auto bg-[var(--bg-paper-back)] rounded-xl border border-[var(--color-lines)]">
          <div className="mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-[var(--color-text)]">{title || 'Untitled Page'}</h1>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)] items-center font-medium">
              <span className="bg-[var(--color-lines)] px-2.5 py-0.5 rounded-full text-[var(--color-text-muted)] border border-[var(--color-lines)]">{category}</span>
              <span>•</span>
              <span>{moodsList.find(m => m.value === mood)?.label}</span>
              {tags.length > 0 && (
                <>
                  <span>•</span>
                  <div className="flex gap-1">
                    {tags.map(tag => (
                      <span key={tag} className="text-[var(--color-accent)] font-semibold">#{tag}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="prose prose-stone max-w-none notebook-paper handwriting-target text-[var(--color-text)] flex-1 p-2">
            {renderMarkdown(content)}

            {/* Preview Attachments List */}
            {attachments.length > 0 && (
              <div className="border-t border-[var(--color-lines)] pt-4 mt-6 space-y-3">
                <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-[var(--color-accent)]" /> Attachments
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map((att) => {
                    const url = decryptedUrls[att.id];
                    return (
                      <div key={att.id} className="bg-[var(--bg-paper)] p-3 rounded-xl border border-[var(--color-lines)] shadow-sm flex flex-col justify-between min-h-[120px] overflow-hidden">
                        {att.type === 'image' ? (
                          <div className="flex-1 flex flex-col justify-between">
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={att.name} className="w-full h-24 object-cover rounded-lg border border-[var(--color-lines)] shadow-inner hover:opacity-95 transition" />
                              </a>
                            ) : (
                              <div className="w-full h-24 bg-[var(--bg-paper-back)] rounded-lg flex items-center justify-center border border-[var(--color-lines)]">
                                <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
                              </div>
                            )}
                            <span className="text-[10px] text-[var(--color-text-muted)] truncate block mt-2 font-mono">{att.name}</span>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col justify-between">
                            <div className="flex-1 flex items-center justify-center py-4">
                              {url ? (
                                <audio src={url} controls className="w-full" />
                              ) : (
                                <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--color-text-muted)] truncate block mt-2 font-mono">{att.name}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-save status message on its own line */}
      <AnimatePresence>
        {autoSaveMsg && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[10px] text-green-600 dark:text-green-400 font-semibold italic flex items-center gap-1.5 mt-4 justify-end select-none"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {autoSaveMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer controls & Info */}
      <div className="mt-4 pt-2 border-t border-[var(--color-lines)] flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
        <div>
          <span>{wordCount} words</span>
          <span className="mx-2">|</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-lines)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold transition disabled:opacity-50 shadow-sm shadow-amber-900/30 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </div>

      {/* Custom Animated Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur & overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            
            {/* Dialog Content Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="bg-[var(--bg-paper)] border-2 border-[var(--color-lines)] max-w-sm w-full rounded-2xl p-6 shadow-2xl z-10 text-center relative overflow-hidden"
            >
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-950/45 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              
              <h3 className="text-base font-bold text-[var(--color-text)] mb-2 font-serif">
                Delete Diary Page
              </h3>
              
              <p className="text-xs text-[var(--color-text-muted)] mb-6 leading-relaxed">
                Are you sure you want to permanently delete this page? This action is encrypted and cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-lines)] bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSaving}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-red-900/25 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Title Validation Warning Modal */}
      <AnimatePresence>
        {showTitleWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur & overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTitleWarning(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            
            {/* Dialog Content Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="bg-[var(--bg-paper)] border-2 border-[var(--color-lines)] max-w-sm w-full rounded-2xl p-6 shadow-2xl z-10 text-center relative overflow-hidden"
            >
              <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-950/45 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              
              <h3 className="text-base font-bold text-[var(--color-text)] mb-2 font-serif">
                Title Required
              </h3>
              
              <p className="text-xs text-[var(--color-text-muted)] mb-6 leading-relaxed">
                Please enter a title for your diary entry before saving.
              </p>
              
              <button
                type="button"
                onClick={() => setShowTitleWarning(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--color-bookmark)] hover:opacity-95 text-white text-xs font-bold transition shadow-md shadow-amber-900/25 cursor-pointer"
              >
                Okay, Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice Recorder Overlay Modal */}
      <AnimatePresence>
        {isRecordingOpen && (
          <VoiceRecorder
            onSave={handleVoiceSave}
            onCancel={() => setIsRecordingOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
