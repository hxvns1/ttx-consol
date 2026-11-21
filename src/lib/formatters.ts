export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSequenceNumber(num: number): string {
  return String(num).padStart(2, '0');
}

export function probeAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (val: number) => {
      if (settled) return;
      settled = true;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(val) && val > 0 ? val : 0);
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity) {
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          const resolved = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime;
          audio.currentTime = 0;
          finish(resolved);
        };
        audio.currentTime = 1e101;
      } else {
        finish(audio.duration);
      }
    };
    audio.onerror = () => finish(0);
    setTimeout(() => finish(0), 4000);
    audio.src = url;
  });
}

export function isValidAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac', 'opus'].includes(ext);
}
