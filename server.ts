import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_VOICES = new Set(['Kore', 'Charon', 'Fenrir', 'Puck', 'Zephyr']);
const MAX_TTS_TEXT_LENGTH = 4000;
const MAX_STYLE_LENGTH = 300;

const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const FALLBACK_TTS_MODEL = 'gemini-3.8-flash-tts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getHttpStatusFromError(err: unknown): number {
  if (err && typeof err === 'object') {
    const rec = err as { status?: unknown; code?: unknown };
    if (typeof rec.status === 'number' && rec.status >= 400 && rec.status < 600) {
      return rec.status;
    }
    if (typeof rec.code === 'number' && rec.code >= 400 && rec.code < 600) {
      return rec.code;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 429;
  }
  if (lower.includes('permission_denied') || lower.includes('403')) return 403;
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) return 400;
  if (lower.includes('not_found') || lower.includes('404')) return 404;
  if (lower.includes('unavailable') || lower.includes('503')) return 503;
  if (lower.includes('deadline_exceeded') || lower.includes('504')) return 504;
  return 500;
}

function formatTtsErrorMessage(err: unknown): { status: number; message: string } {
  const status = getHttpStatusFromError(err);
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    status === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return {
      status: 403,
      message:
        'API key Gemini tidak valid atau belum memiliki izin. Periksa kunci API pada panel Settings > Secrets.',
    };
  }

  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Batas permintaan (kuota per menit) Gemini Text-to-Speech sedang penuh. Tunggu 10–15 detik lalu klik lagi, atau gunakan kunci API berbayar di Settings > Secrets.',
    };
  }

  if (status === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      message:
        'Model Gemini Text-to-Speech tidak tersedia untuk kunci API ini. Periksa pengaturan kunci API pada Settings > Secrets.',
    };
  }

  if (status === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      message:
        'Teks atau instruksi gaya tidak dapat diproses oleh Gemini TTS. Coba persingkat teks atau gunakan gaya standar.',
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: raw || 'Gagal menghasilkan audio narasi dari Gemini.',
  };
}

function wrapPcm16ToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function normalizeAudioBase64ToWav(
  base64Data: string,
  rawMimeType?: string,
): { audioBase64: string; mimeType: string } {
  const cleaned = base64Data.replace(/[\r\n\s]/g, '');
  const buf = Buffer.from(cleaned, 'base64');
  const hasRiffHeader =
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE';

  if (hasRiffHeader) {
    return { audioBase64: cleaned, mimeType: 'audio/wav' };
  }

  const lowerMime = (rawMimeType || '').toLowerCase();
  if (lowerMime.includes('l16') || lowerMime.includes('pcm') || !lowerMime) {
    const rateMatch = /rate=(\d+)/i.exec(lowerMime);
    const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
    const wavBuf = wrapPcm16ToWav(buf, sampleRate, 1);
    return { audioBase64: wavBuf.toString('base64'), mimeType: 'audio/wav' };
  }

  return { audioBase64: cleaned, mimeType: rawMimeType || 'audio/wav' };
}

async function callGeminiTtsModel(
  ai: GoogleGenAI,
  model: string,
  text: string,
  voiceName: string,
  style: string,
) {
  return ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            ...(style
              ? {
                  speechMetadata: {
                    style,
                  },
                }
              : {}),
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
}

async function generateNarrativeSpeech(
  ai: GoogleGenAI,
  text: string,
  voiceName: string,
  style: string,
) {
  const retryDelaysMs = [1500, 3000, 5000];
  let lastError: unknown;

  // 1. Try primary fast TTS model with exponential backoff on 429 / 5xx
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await callGeminiTtsModel(
        ai,
        PRIMARY_TTS_MODEL,
        text,
        voiceName,
        style,
      );
    } catch (err) {
      lastError = err;
      const status = getHttpStatusFromError(err);
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === retryDelaysMs.length) {
        break;
      }
      const jitter = Math.floor(Math.random() * 400);
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelaysMs[attempt] + jitter),
      );
    }
  }

  // 2. If primary model is rate-limited (429) or temporarily unavailable (503/504),
  //    automatically try the flagship TTS model (separate quota bucket).
  const primaryStatus = getHttpStatusFromError(lastError);
  if (primaryStatus === 429 || primaryStatus === 503 || primaryStatus === 504) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await callGeminiTtsModel(
          ai,
          FALLBACK_TTS_MODEL,
          text,
          voiceName,
          style,
        );
      } catch (fallbackErr) {
        lastError = fallbackErr;
        const fbStatus = getHttpStatusFromError(fallbackErr);
        if ((fbStatus !== 429 && fbStatus < 500) || attempt === 1) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/tts', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY belum tersedia di server. Pastikan kunci API sudah terpasang di Settings > Secrets.',
      });
      return;
    }

    const body = (req.body ?? {}) as {
      text?: unknown;
      voiceName?: unknown;
      style?: unknown;
    };

    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    if (!rawText) {
      res.status(400).json({ error: 'Teks narasi tidak boleh kosong.' });
      return;
    }

    const cleanText =
      rawText.length > MAX_TTS_TEXT_LENGTH
        ? rawText.slice(0, MAX_TTS_TEXT_LENGTH)
        : rawText;

    const requestedVoice =
      typeof body.voiceName === 'string' ? body.voiceName.trim() : 'Kore';
    const voiceName = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : 'Kore';

    const rawStyle = typeof body.style === 'string' ? body.style.trim() : '';
    const cleanStyle =
      rawStyle.length > MAX_STYLE_LENGTH
        ? rawStyle.slice(0, MAX_STYLE_LENGTH)
        : rawStyle;

    try {
      const response = await generateNarrativeSpeech(
        ai,
        cleanText,
        voiceName,
        cleanStyle,
      );

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const audioPart = parts.find((part) => Boolean(part.inlineData?.data));
      const inlineData = audioPart?.inlineData;

      if (!inlineData?.data) {
        const finishReason = candidate?.finishReason;
        console.warn('[TTS] No audio inlineData returned', {
          finishReason,
          partsCount: parts.length,
        });
        res.status(502).json({
          error:
            finishReason && finishReason !== 'STOP'
              ? `Model Gemini menghentikan pembuatan audio (${finishReason}). Coba ubah sedikit redaksi teks atau gaya pembacaan.`
              : 'Model Gemini tidak mengembalikan data audio. Silakan coba kembali.',
        });
        return;
      }

      const normalized = normalizeAudioBase64ToWav(
        inlineData.data,
        inlineData.mimeType,
      );

      res.json({
        audioBase64: normalized.audioBase64,
        mimeType: normalized.mimeType,
        voiceName,
      });
    } catch (err) {
      const formatted = formatTtsErrorMessage(err);
      console.error('[TTS] Generation failed:', formatted.status, err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TTX Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
