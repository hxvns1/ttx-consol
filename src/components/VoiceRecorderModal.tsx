import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import type { DialogueItem } from '../types/ttx';
import {
  formatDuration,
  formatFileSize,
  formatSequenceNumber,
} from '../lib/formatters';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  dialogue: DialogueItem | null;
  hasExistingAudio: boolean;
  onClose: () => void;
  onSaveRecording: (dialogueId: string, file: File) => Promise<void> | void;
}

type RecorderPhase = 'idle' | 'recording' | 'paused' | 'preview';

const CANDIDATE_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of CANDIDATE_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // Ignore unsupported check errors
    }
  }
  return '';
}

function extensionForMime(mime: string): string {
  const clean = mime.toLowerCase();
  if (clean.includes('mp4') || clean.includes('aac')) return 'm4a';
  if (clean.includes('ogg')) return 'ogg';
  if (clean.includes('wav')) return 'wav';
  return 'webm';
}

function cleanBaseMime(mime: string): string {
  const base = mime.split(';')[0]?.trim();
  if (base && base.startsWith('audio/')) return base;
  return 'audio/webm';
}

function friendlyMicError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: string }).name);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Akses mikrofon ditolak. Izinkan penggunaan mikrofon di pengaturan browser lalu coba lagi.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Perangkat mikrofon tidak ditemukan. Pastikan mikrofon terhubung atau aktif.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Mikrofon sedang digunakan oleh aplikasi lain. Tutup aplikasi lain tersebut lalu coba lagi.';
    }
    if (name === 'SecurityError') {
      return 'Perekaman suara memerlukan koneksi aman (HTTPS) dan izin mikrofon.';
    }
  }
  return 'Gagal mengakses mikrofon browser. Pastikan izin mikrofon sudah diaktifkan.';
}

const METER_BARS = 18;

export function VoiceRecorderModal({
  isOpen,
  dialogue,
  hasExistingAudio,
  onClose,
  onSaveRecording,
}: VoiceRecorderModalProps) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState('audio/webm');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [supportsPause, setSupportsPause] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordedMsRef = useRef<number>(0);
  const segmentStartMsRef = useRef<number>(0);
  const discardedRef = useRef<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMicrophone = useCallback(() => {
    stopMeterLoop();
    stopTimer();
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [stopMeterLoop, stopTimer]);

  const stopPreviewAudio = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
  }, []);

  const clearPreviewState = useCallback(() => {
    stopPreviewAudio();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setRecordedBlob(null);
    setPreviewDuration(0);
    setPreviewCurrentTime(0);
  }, [stopPreviewAudio]);

  const abortActiveRecording = useCallback(() => {
    discardedRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        // Ignore stop errors during cleanup
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    releaseMicrophone();
  }, [releaseMicrophone]);

  // Reset state whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      abortActiveRecording();
      clearPreviewState();
      setPhase('idle');
      setErrorMessage(null);
      setElapsedSeconds(0);
      setIsSaving(false);
    }
    return () => {
      abortActiveRecording();
      clearPreviewState();
    };
  }, [isOpen, dialogue?.id, abortActiveRecording, clearPreviewState]);

  const startMeterLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const normalized = (buffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      // Scale RMS cleanly into 0..1 range for speech volume visibility
      const scaled = Math.min(1, rms * 4.2);
      setMicLevel(scaled);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startTimerLoop = useCallback(() => {
    stopTimer();
    segmentStartMsRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const totalMs =
        recordedMsRef.current + (Date.now() - segmentStartMsRef.current);
      setElapsedSeconds(totalMs / 1000);
    }, 150);
  }, [stopTimer]);

  const handleStartRecording = async () => {
    setErrorMessage(null);
    clearPreviewState();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorMessage(
        'Browser ini belum mendukung perekaman suara langsung. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup live microphone level analyser
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.7;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        }
      } catch {
        // Proceed with recording even if AudioContext visualization is unavailable
      }

      const preferredMime = pickSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      discardedRef.current = false;
      chunksRef.current = [];
      recordedMsRef.current = 0;
      setElapsedSeconds(0);
      setSupportsPause(typeof recorder.pause === 'function');

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        releaseMicrophone();
        setPhase('idle');
        setErrorMessage('Terjadi gangguan saat merekam audio. Silakan coba lagi.');
      };

      recorder.onstop = () => {
        const finalElapsedSec =
          (recordedMsRef.current +
            (recorder.state === 'inactive' && segmentStartMsRef.current > 0
              ? Date.now() - segmentStartMsRef.current
              : 0)) /
          1000;
        segmentStartMsRef.current = 0;
        releaseMicrophone();
        mediaRecorderRef.current = null;

        if (discardedRef.current) {
          chunksRef.current = [];
          return;
        }

        const resolvedMime =
          recorder.mimeType || preferredMime || 'audio/webm';
        const baseMime = cleanBaseMime(resolvedMime);
        const blob = new Blob(chunksRef.current, { type: baseMime });
        chunksRef.current = [];

        if (blob.size === 0) {
          setPhase('idle');
          setErrorMessage(
            'Rekaman suara kosong. Pastikan mikrofon tidak dalam keadaan bisu lalu coba lagi.',
          );
          return;
        }

        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setRecordedBlob(blob);
        setRecordedMime(baseMime);
        setPreviewUrl(url);
        setPreviewDuration(Math.max(0.5, finalElapsedSec));
        setPreviewCurrentTime(0);
        setIsPreviewPlaying(false);
        setPhase('preview');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setPhase('recording');
      startTimerLoop();
      startMeterLoop();
    } catch (err) {
      releaseMicrophone();
      setPhase('idle');
      setErrorMessage(friendlyMicError(err));
    }
  };

  const handlePauseResume = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;

    if (rec.state === 'recording') {
      try {
        rec.pause();
        recordedMsRef.current += Date.now() - segmentStartMsRef.current;
        segmentStartMsRef.current = 0;
        stopTimer();
        stopMeterLoop();
        setElapsedSeconds(recordedMsRef.current / 1000);
        setPhase('paused');
      } catch {
        // Ignore if browser rejects pause
      }
    } else if (rec.state === 'paused') {
      try {
        rec.resume();
        setPhase('recording');
        startTimerLoop();
        startMeterLoop();
      } catch {
        // Ignore if browser rejects resume
      }
    }
  };

  const handleStopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    if (rec.state === 'recording' && segmentStartMsRef.current > 0) {
      recordedMsRef.current += Date.now() - segmentStartMsRef.current;
      segmentStartMsRef.current = 0;
    }
    stopTimer();
    stopMeterLoop();
    try {
      rec.stop();
    } catch {
      releaseMicrophone();
      setPhase('idle');
    }
  };

  const handleReRecord = () => {
    setErrorMessage(null);
    clearPreviewState();
    setElapsedSeconds(0);
    setPhase('idle');
  };

  const handleTogglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio || !previewUrl) return;
    if (audio.paused) {
      if (
        audio.ended ||
        (previewDuration > 0 && audio.currentTime >= previewDuration - 0.1)
      ) {
        audio.currentTime = 0;
      }
      void audio.play().catch(() => {
        setErrorMessage('Gagal memutar pratinjau rekaman.');
      });
    } else {
      audio.pause();
    }
  };

  const handlePreviewSeek = (seconds: number) => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPreviewCurrentTime(seconds);
  };

  const handleSave = async () => {
    if (!dialogue || !recordedBlob || isSaving) return;
    stopPreviewAudio();
    setIsSaving(true);
    try {
      const ext = extensionForMime(recordedMime);
      const seqLabel = formatSequenceNumber(dialogue.sequenceNumber);
      const safeSender = dialogue.sender
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20);
      const fileName = safeSender
        ? `rekaman-${seqLabel}-${safeSender}.${ext}`
        : `rekaman-dialog-${seqLabel}.${ext}`;
      const file = new File([recordedBlob], fileName, {
        type: recordedMime,
        lastModified: Date.now(),
      });
      await onSaveRecording(dialogue.id, file);
      onClose();
    } catch {
      setErrorMessage('Gagal menyimpan rekaman suara. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    if (isSaving) return;
    abortActiveRecording();
    clearPreviewState();
    onClose();
  };

  if (!isOpen || !dialogue) return null;

  const progressPct =
    previewDuration > 0
      ? Math.min(100, (previewCurrentTime / previewDuration) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-recorder-title"
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="voice-recorder-title"
              className="text-base font-bold text-[#0E2439]"
            >
              Rekam Suara Percakapan #{formatSequenceNumber(dialogue.sequenceNumber)}
            </h2>
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
              <span className="font-semibold text-[#0E2439]">{dialogue.sender}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-semibold text-[#0E2439]">{dialogue.receiver}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            disabled={isSaving}
            aria-label="Tutup dialog rekam suara"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Script Teleprompter Card */}
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500">
              Naskah Percakapan untuk Dibaca
            </div>
            <p className="text-sm leading-relaxed text-slate-900">
              &ldquo;{dialogue.transcript}&rdquo;
            </p>
            {dialogue.note && (
              <p className="text-xs text-slate-500 pt-1">
                Catatan: {dialogue.note}
              </p>
            )}
          </div>

          {hasExistingAudio && phase !== 'preview' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Percakapan ini sudah memiliki file audio. Menyimpan rekaman baru akan menggantikan audio yang sedang terpasang.
            </p>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-md px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Phase 1: Idle / Ready to Record */}
          {phase === 'idle' && (
            <div className="py-5 px-4 rounded-md border border-slate-200 bg-white flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-[#DC2626]">
                <Mic className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-sm">
                <div className="text-sm font-semibold text-[#0E2439]">
                  Siap Merekam dari Mikrofon
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tekan tombol di bawah untuk mulai merekam. Setelah selesai, Anda dapat mendengarkan pratinjau atau merekam ulang sebelum disimpan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleStartRecording();
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors whitespace-nowrap"
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span>Mulai Rekam</span>
              </button>
            </div>
          )}

          {/* Phase 2: Recording / Paused */}
          {(phase === 'recording' || phase === 'paused') && (
            <div className="py-5 px-4 rounded-md border border-slate-200 bg-white flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {phase === 'recording' ? (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse"
                      aria-hidden="true"
                    />
                    <span className="text-[#DC2626]">Sedang Merekam</span>
                  </>
                ) : (
                  <span className="text-amber-700">Rekaman Dijeda</span>
                )}
              </div>

              <div className="font-mono text-3xl font-bold tabular-nums text-[#0E2439]">
                {formatDuration(elapsedSeconds)}
              </div>

              {/* Live Microphone Level Meter */}
              <div
                aria-label="Indikator level suara mikrofon"
                className="flex items-end justify-center gap-1 h-8 w-full max-w-[240px]"
              >
                {Array.from({ length: METER_BARS }).map((_, idx) => {
                  const centerOffset = Math.abs(idx - (METER_BARS - 1) / 2) / ((METER_BARS - 1) / 2);
                  const shapedLevel = Math.max(
                    0.12,
                    micLevel * (1 - centerOffset * 0.55),
                  );
                  const heightPct =
                    phase === 'paused'
                      ? 14
                      : Math.min(100, Math.round(shapedLevel * 100));
                  const isActiveBar = phase === 'recording' && micLevel > 0.04;
                  return (
                    <span
                      key={idx}
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        isActiveBar ? 'bg-[#DC2626]' : 'bg-slate-200'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {supportsPause && (
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-md text-xs font-medium text-[#0E2439] bg-white border border-slate-300 hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    {phase === 'paused' ? (
                      <>
                        <Mic className="w-3.5 h-3.5 shrink-0" />
                        <span>Lanjutkan</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 shrink-0" />
                        <span>Jeda</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-5 py-2 rounded-md text-xs font-semibold text-white bg-[#0E2439] hover:bg-[#193A58] transition-colors whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5 shrink-0" />
                  <span>Selesai Rekam</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Preview, Re-record, or Save */}
          {phase === 'preview' && previewUrl && recordedBlob && (
            <div className="p-4 rounded-md border border-slate-200 bg-slate-50/70 space-y-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#0E2439]">
                  Pratinjau Hasil Rekaman
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">
                  {formatFileSize(recordedBlob.size)}
                </span>
              </div>

              {/* Hidden HTMLAudioElement synced with custom scrubber */}
              <audio
                ref={previewAudioRef}
                src={previewUrl}
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) {
                    setPreviewDuration(d);
                  }
                }}
                onTimeUpdate={(e) => {
                  setPreviewCurrentTime(e.currentTarget.currentTime || 0);
                }}
                onPlay={() => setIsPreviewPlaying(true)}
                onPause={() => setIsPreviewPlaying(false)}
                onEnded={() => {
                  setIsPreviewPlaying(false);
                  setPreviewCurrentTime(previewDuration);
                }}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePreviewPlay}
                  aria-label={
                    isPreviewPlaying
                      ? 'Jeda pratinjau rekaman'
                      : 'Putar pratinjau rekaman'
                  }
                  className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-[#0E2439] text-white hover:bg-[#193A58] transition-colors shrink-0"
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>

                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="font-mono text-[11px] tabular-nums text-slate-600 shrink-0 w-[40px]">
                    {formatDuration(previewCurrentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={previewDuration > 0 ? previewDuration : 1}
                    step={0.1}
                    value={Math.min(previewCurrentTime, previewDuration || 1)}
                    onChange={(e) =>
                      handlePreviewSeek(parseFloat(e.target.value))
                    }
                    aria-label="Posisi waktu pratinjau rekaman"
                    className="audio-scrubber w-full"
                    style={{
                      background: `linear-gradient(to right, #0E2439 0%, #0E2439 ${progressPct}%, #CBD5E1 ${progressPct}%, #CBD5E1 100%)`,
                      height: '4px',
                      borderRadius: '9999px',
                    }}
                  />
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0 w-[40px] text-right">
                    {formatDuration(previewDuration)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleReRecord}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Rekam Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-md text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Audio'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={handleCloseModal}
            disabled={isSaving}
            className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {phase === 'recording' || phase === 'paused' ? 'Batalkan Rekaman' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}
