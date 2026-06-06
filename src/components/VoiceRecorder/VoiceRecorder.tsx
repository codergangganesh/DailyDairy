import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, Trash2, Save, X, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
  onSave: (audioBlob: Blob, name: string) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSave, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopStreamsAndTimers();
    };
  }, []);

  const stopStreamsAndTimers = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // Recording Timer Effect
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    setErrorMsg('');
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        
        // Stop stream tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error starting audio record:', err);
      setErrorMsg('Could not access microphone. Please grant permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePlayToggle = () => {
    if (!audioPlayerRef.current) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleDiscard = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (audioBlob) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      onSave(audioBlob, `voice_memo_${timestamp}.webm`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isRecording ? undefined : onCancel}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
      />

      {/* Main card dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[var(--bg-paper)] border-2 border-[var(--color-lines)] max-w-sm w-full rounded-2xl p-6 shadow-2xl z-10 text-center relative overflow-hidden"
      >
        <button
          onClick={onCancel}
          disabled={isRecording}
          className="absolute right-4 top-4 p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--bg-paper-back)] rounded-lg transition disabled:opacity-30 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-[var(--color-text)] mb-1 font-serif">
          Record Voice Memo
        </h3>
        <p className="text-[10px] text-[var(--color-text-muted)] mb-6 uppercase tracking-wider">
          Client-Side E2E Encrypted Recording
        </p>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl p-3 mb-4 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col items-center justify-center min-h-[140px]">
          {/* ── RECORDING STATE ── */}
          {isRecording && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                {/* Pulsing rings */}
                <motion.div
                  animate={{ scale: [1, 1.8, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  className="absolute w-16 h-16 rounded-full bg-red-500/15"
                />
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute w-16 h-16 rounded-full bg-red-500/25"
                />
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-all duration-200 z-10 cursor-pointer"
                >
                  <Square className="w-5 h-5 fill-white" />
                </button>
              </div>
              <span className="text-lg font-bold text-red-500 font-mono tracking-wider animate-pulse">
                {formatDuration(recordingTime)}
              </span>
              <p className="text-xs text-[var(--color-text-muted)]">Recording in progress... Tap stop to complete.</p>
            </div>
          )}

          {/* ── IDLE / WAITING STATE ── */}
          {!isRecording && !audioUrl && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full bg-[var(--color-bookmark)] hover:opacity-95 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Mic className="w-6 h-6" />
              </button>
              <span className="text-sm font-semibold text-[var(--color-text-muted)] font-mono">
                00:00
              </span>
              <p className="text-xs text-[var(--color-text-muted)] px-4">
                Tap microphone to request permissions and start recording.
              </p>
            </div>
          )}

          {/* ── PREVIEW STATE (RECORDING COMPLETE) ── */}
          {!isRecording && audioUrl && (
            <div className="flex flex-col items-center gap-4 w-full px-2">
              <div className="flex items-center gap-4 justify-center">
                {/* Playback Button */}
                <button
                  onClick={handlePlayToggle}
                  className="w-14 h-14 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>
              </div>
              
              <div className="text-xs font-semibold text-[var(--color-text)] bg-[var(--bg-paper-back)] px-3 py-1.5 rounded-full border border-[var(--color-lines)] font-mono">
                Duration: {formatDuration(recordingTime)}
              </div>

              {/* Hidden HTML Audio Player */}
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={handleAudioEnded}
                className="hidden"
              />

              <div className="flex gap-2.5 w-full mt-4">
                <button
                  onClick={handleDiscard}
                  className="flex-1 py-2 rounded-xl border border-red-200 hover:bg-red-500/5 text-red-500 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Discard
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded-xl bg-[var(--color-bookmark)] hover:opacity-95 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-900/20 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Keep Memo
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
