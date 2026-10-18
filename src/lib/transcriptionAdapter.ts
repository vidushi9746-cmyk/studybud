/**
 * Modular Transcription Adapter for StudyBud
 *
 * Transcribes lecture audio and video files using Google's official Gemini 3.5 Transcribe
 * model (`gemini-3.5-transcribe`) available under the free tier using the project's
 * existing GEMINI_API_KEY.
 *
 * Keeps provider credentials on the server and provides graceful fallbacks for rate
 * limits, unsupported media, and silent/empty audio.
 */

import { GoogleGenAI } from '@google/genai';

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  durationSeconds?: number;
  provider?: string;
  error?: string;
  details?: string;
  requiresManualInput?: boolean;
}

const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit
const SUPPORTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/ogg',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'video/mp4',
  'video/webm',
];

export async function transcribeMedia(
  fileBuffer: Uint8Array,
  mimeType: string,
  fileName: string
): Promise<TranscriptionResult> {
  // 1. Validate file size
  if (fileBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) {
    return {
      success: false,
      error: 'File size exceeds limit',
      details: `The uploaded media file (${(fileBuffer.byteLength / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed limit of 15MB.`,
    };
  }

  // 2. Validate MIME type
  const normalizedMime = mimeType.toLowerCase();
  const isSupported = SUPPORTED_MIME_TYPES.some((m) =>
    normalizedMime.includes(m.split('/')[1])
  );
  if (!isSupported) {
    return {
      success: false,
      error: 'Unsupported media format',
      details: `The format "${mimeType}" is not supported. Supported audio/video formats: MP3, WAV, M4A, WebM, MP4.`,
    };
  }

  // 3. Check for Google Gemini API Key
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  // Also support optional external STT key if explicitly provided
  const externalSttKey = process.env.SPEECH_TO_TEXT_API_KEY?.trim();

  if (!geminiApiKey && !externalSttKey) {
    return {
      success: false,
      requiresManualInput: true,
      error: 'API Key not configured',
      details:
        'GEMINI_API_KEY is not configured on the server. Please add your key to .env.local or paste the lecture transcript directly into the workspace.',
    };
  }

  // 4. Primary: Transcribe using Gemini 3.5 Transcribe with existing Google API key
  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const base64Data = Buffer.from(fileBuffer).toString('base64');

      // Use native audio MIME mapping
      let effectiveMime = normalizedMime;
      if (normalizedMime.includes('m4a')) effectiveMime = 'audio/m4a';
      else if (normalizedMime.includes('wav')) effectiveMime = 'audio/wav';
      else if (normalizedMime.includes('mp3') || normalizedMime.includes('mpeg')) effectiveMime = 'audio/mp3';
      else if (normalizedMime.includes('webm')) effectiveMime = 'audio/webm';
      else if (normalizedMime.includes('ogg')) effectiveMime = 'audio/ogg';

      // Call gemini-3.5-transcribe
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: effectiveMime, data: base64Data } },
              { text: 'Transcribe this lecture audio verbatim. Output only the transcribed speech.' },
            ],
          },
        ],
      });

      // Extract transcription text
      const part = response.candidates?.[0]?.content?.parts?.[0] as any;
      const transcribedText = (
        part?.audioTranscription?.text ||
        part?.text ||
        response.text ||
        ''
      ).trim();

      if (!transcribedText) {
        return {
          success: false,
          error: 'No audible speech detected',
          details:
            'The audio was processed, but no clear spoken words could be recognized. Please check the recording or paste the transcript directly.',
          requiresManualInput: true,
        };
      }

      return {
        success: true,
        text: transcribedText,
        provider: 'Gemini 3.5 Transcribe (Google Free Tier)',
      };
    } catch (err: any) {
      const errMsg = err?.message || '';

      // Handle malformed or empty audio streams (HTTP 400) - no fallback needed
      if (errMsg.includes('400') || errMsg.includes('INVALID_ARGUMENT')) {
        return {
          success: false,
          error: 'Unreadable audio stream',
          details:
            'The audio file appears to be too short, silent, or in an unreadable encoding. Please verify the audio file or paste the transcript.',
          requiresManualInput: true,
        };
      }

      // Safe fallback to verified gemini-3.5-flash-lite (avoid exhausted gemini-3.8-flash)
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const base64Data = Buffer.from(fileBuffer).toString('base64');
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: [
            {
              parts: [
                { inlineData: { mimeType: normalizedMime, data: base64Data } },
                { text: 'Transcribe this audio verbatim. Output only the transcribed text.' },
              ],
            },
          ],
        });

        const part = fallbackRes.candidates?.[0]?.content?.parts?.[0] as any;
        const text = (part?.text || fallbackRes.text || '').trim();
        if (text) {
          return {
            success: true,
            text,
            provider: 'Gemini 3.5 Flash Lite (Fallback)',
          };
        }
      } catch (fallbackErr: any) {
        const fbMsg = fallbackErr?.message || '';
        if (fbMsg.includes('429') || fbMsg.includes('RESOURCE_EXHAUSTED')) {
          return {
            success: false,
            error: 'Audio transcription quota limit reached',
            details:
              'Google AI Studio free-tier audio transcription limits have been reached. Please wait a moment and try again, or paste your lecture transcript directly into the workspace.',
            requiresManualInput: true,
          };
        }
      }

      return {
        success: false,
        error: 'Audio transcription quota or rate limit reached',
        details:
          'Google AI Studio free-tier transcription is temporarily busy or quota-limited. Please wait a moment before trying again, or copy and paste the lecture transcript directly into the workspace.',
        requiresManualInput: true,
      };
    }
  }

  // 5. External STT fallback (if user configured optional SPEECH_TO_TEXT_API_KEY)
  if (externalSttKey) {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer as any], { type: mimeType });
      formData.append('file', blob, fileName);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${externalSttKey}` },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return {
          success: false,
          error: 'External transcription error',
          details: errJson?.error?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        text: (data.text || '').trim(),
        provider: 'Whisper STT',
      };
    } catch (extErr: any) {
      return {
        success: false,
        error: 'External transcription failed',
        details: extErr.message,
      };
    }
  }

  return {
    success: false,
    requiresManualInput: true,
    error: 'No transcription service available',
  };
}
