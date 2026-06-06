import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AvatarUploaderProps {
  /** Size of the avatar circle in pixels (default 80). Set to 0 for trigger-only mode. */
  size?: number;
  /** Optional extra className on the root wrapper */
  className?: string;
  /**
   * When true, renders only a hidden file input + preview modal (no avatar UI).
   * The parent should call the ref's .open() method to trigger it.
   */
  triggerOnly?: boolean;
}

export interface AvatarUploaderHandle {
  /** Open the file picker programmatically */
  open: () => void;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const AvatarUploader = forwardRef<AvatarUploaderHandle, AvatarUploaderProps>(
  ({ size = 80, className = '', triggerOnly = false }, ref) => {
    const { user, uploadAvatar } = useAuth();

    const inputRef = useRef<HTMLInputElement>(null);

    // Expose open() to parent via ref
    useImperativeHandle(ref, () => ({
      open: () => inputRef.current?.click(),
    }));

    // preview modal state
    const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
    const [pendingFile, setPendingFile]     = useState<File | null>(null);
    const [validationErr, setValidationErr] = useState<string>('');
    const [isUploading, setIsUploading]     = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadError, setUploadError]     = useState('');

    // ── Pick a file ────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setValidationErr('');
      setUploadError('');
      setUploadSuccess(false);

      const file = e.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        setValidationErr('Unsupported format. Use JPEG, PNG, WebP, or GIF.');
        e.target.value = '';
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setValidationErr(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 2 MB.`);
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewDataUrl(reader.result as string);
        setPendingFile(file);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }, []);

    // ── Drag-and-drop ─────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const synth = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(synth);
    }, [handleFileChange]);

    // ── Confirm upload ─────────────────────────────────────────────
    const handleConfirm = async () => {
      if (!pendingFile) return;
      setIsUploading(true);
      setUploadError('');
      try {
        await uploadAvatar(pendingFile);
        setUploadSuccess(true);
        setTimeout(() => {
          setPreviewDataUrl(null);
          setPendingFile(null);
          setUploadSuccess(false);
        }, 1200);
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
    };

    // ── Cancel preview ─────────────────────────────────────────────
    const handleCancel = () => {
      setPreviewDataUrl(null);
      setPendingFile(null);
      setUploadError('');
      setValidationErr('');
    };

    // Current avatar URL to display
    const currentAvatar = user?.avatar_url || null;
    const isRealPhoto   = currentAvatar?.startsWith('data:') || currentAvatar?.startsWith('http');

    return (
      <>
        {/* Hidden file input — always rendered */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload profile photo"
        />

        {/* ── Avatar circle UI (hidden when triggerOnly) ─────────── */}
        {!triggerOnly && (
          <div
            className={`relative group flex-shrink-0 ${className}`}
            style={{ width: size, height: size }}
          >
            {/* Avatar image */}
            {isRealPhoto ? (
              <img
                src={currentAvatar!}
                alt="Profile"
                className="w-full h-full rounded-full object-cover border-2 border-[var(--color-accent)] shadow-md"
              />
            ) : (
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.avatar_url || user?.username || 'user'}`}
                alt="Profile"
                className="w-full h-full rounded-full bg-[var(--bg-paper-back)] border-2 border-[var(--color-accent)] p-1.5 shadow-md"
              />
            )}

            {/* Camera hover overlay */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`absolute inset-0 rounded-full flex flex-col items-center justify-center cursor-pointer
                bg-black/55 transition-opacity duration-200
                ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Change profile photo"
            >
              <Camera className="w-5 h-5 text-white mb-0.5" />
              <span className="text-[9px] text-white font-bold tracking-wide">
                {isDragging ? 'Drop' : 'Change'}
              </span>
            </button>

            {/* Validation error badge */}
            {validationErr && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                <AlertTriangle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Validation error text */}
        {!triggerOnly && validationErr && (
          <p className="text-[10px] text-red-500 font-semibold mt-1 text-center max-w-[160px]">
            {validationErr}
          </p>
        )}

        {/* ── Preview / Confirm Modal — always rendered ────────────── */}
        <AnimatePresence>
          {previewDataUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="bg-[var(--bg-paper)] rounded-2xl shadow-2xl border border-[var(--color-lines)] w-full max-w-sm overflow-hidden"
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-lines)]">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[var(--color-accent)]" />
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Upload Profile Photo</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4 p-6">
                  {/* Preview image */}
                  <div className="relative">
                    <img
                      src={previewDataUrl}
                      alt="Preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-[var(--color-accent)] shadow-lg"
                    />
                    {uploadSuccess && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute inset-0 rounded-full bg-green-500/80 flex items-center justify-center"
                      >
                        <Check className="w-10 h-10 text-white" />
                      </motion.div>
                    )}
                  </div>

                  {/* File info */}
                  {pendingFile && (
                    <div className="text-center">
                      <p className="text-xs font-semibold text-[var(--color-text)] truncate max-w-[220px]">{pendingFile.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {(pendingFile.size / 1024).toFixed(0)} KB • {pendingFile.type.split('/')[1].toUpperCase()}
                      </p>
                    </div>
                  )}

                  {/* Validation / upload error */}
                  {(validationErr || uploadError) && (
                    <div className="w-full flex items-start gap-2 bg-red-500/10 border border-red-500/25 text-red-500 text-xs font-semibold p-3 rounded-xl">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{uploadError || validationErr}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 w-full">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isUploading}
                      className="flex-1 py-2.5 border border-[var(--color-lines)] text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isUploading || uploadSuccess}
                      className="flex-1 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {isUploading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                      ) : uploadSuccess ? (
                        <><Check className="w-3.5 h-3.5" /> Saved!</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> Set as Photo</>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { handleCancel(); setTimeout(() => inputRef.current?.click(), 50); }}
                    className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition cursor-pointer underline underline-offset-2"
                  >
                    Choose a different photo
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }
);

AvatarUploader.displayName = 'AvatarUploader';
