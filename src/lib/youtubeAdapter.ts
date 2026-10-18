/**
 * YouTube Video Adapter for StudyBud
 *
 * Uses official Google Gemini multimodal API via @google/genai to directly analyze
 * public YouTube video URLs (both visual frames and audio track) on the free tier.
 *
 * Free Tier Quotas & Limits:
 * - Up to 8 hours of YouTube video processing per day on the free tier.
 * - Standard Flash RPM / RPD limits.
 * - Only publicly accessible YouTube videos are supported (private/unlisted return 403).
 */

import { GoogleGenAI } from '@google/genai';
import { SupportedLanguage } from '@/types/study';
import { formatExplanationForDisplay } from '@/lib/explanationFormatter';

export interface YouTubeExplainParams {
  videoUrl: string;
  language?: SupportedLanguage;
  simpleLanguage?: boolean;
}

export interface YouTubeExplainResult {
  success: boolean;
  text?: string;
  canonicalUrl?: string;
  error?: string;
  details?: string;
  warning?: string;
  modelUsed?: string;
}

/**
 * Extracts the canonical 11-character YouTube video ID from various URL formats.
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeVideoId(urlStr: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;

  try {
    const trimmed = urlStr.trim();
    // Prepend protocol if missing
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();

    // youtu.be/ID
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    // youtube.com
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      // /watch?v=ID
      if (parsed.pathname === '/watch' || parsed.pathname.endsWith('/watch')) {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return v;
        }
      }
      // /embed/ID or /shorts/ID or /v/ID or /live/ID
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'v', 'live'].includes(parts[0])) {
        const id = parts[1];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Returns true if the URL is a recognized YouTube video link.
 */
export function isPublicYouTubeUrl(urlStr: string): boolean {
  return extractYouTubeVideoId(urlStr) !== null;
}

/**
 * Builds the canonical watch URL from any valid YouTube URL format.
 */
export function getCanonicalYouTubeUrl(urlStr: string): string | null {
  const id = extractYouTubeVideoId(urlStr);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

function getLanguageInstruction(lang: SupportedLanguage = 'English'): string {
  switch (lang) {
    case 'Hindi':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain completely in clear, natural Hindi (हिन्दी) using Devanagari script, keeping essential scientific/technical terms in parentheses.';
    case 'Kannada':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain completely in clear, accessible Kannada (ಕನ್ನಡ) script, keeping essential scientific/technical terms in parentheses.';
    case 'Hinglish':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain in conversational Hinglish (a natural, friendly blend of Hindi and English written in the Latin alphabet widely spoken by students in India).';
    case 'English':
    default:
      return 'Explain in clear, standard English with student-friendly vocabulary.';
  }
}

/**
 * Explains a public YouTube video directly using Google Gemini's multimodal video understanding.
 */
export async function explainYouTubeVideo({
  videoUrl,
  language = 'English',
  simpleLanguage = false,
}: YouTubeExplainParams): Promise<YouTubeExplainResult> {
  const canonicalUrl = getCanonicalYouTubeUrl(videoUrl);

  if (!canonicalUrl) {
    return {
      success: false,
      error: 'Invalid or unsupported video link',
      details:
        'Please enter a valid public YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...). For Vimeo or other platforms, please paste the lecture transcript directly below.',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing server API key',
      details: 'GEMINI_API_KEY is not configured on the server. Please check your server environment.',
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const langInstruction = getLanguageInstruction(language);

  const promptParts = [
    `You are StudyBud's accessible video lecture tutor powered by Google Gemini multimodal video understanding.`,
    `Analyze this public educational YouTube video carefully by watching the visual presentation and listening to the spoken audio.`,
    langInstruction,
    simpleLanguage
      ? `SIMPLIFIED MODE (Explain Like I'm 10): Use vivid real-world analogies, straightforward everyday vocabulary, brief sentences, and conversational clarity. Avoid intimidating academic jargon unless immediately defined with an intuitive metaphor.`
      : `STANDARD ACCESSIBLE MODE: Provide a well-structured, clear explanation with bullet points, bold key terms, and intuitive summaries.`,
    `\nSTRUCTURE YOUR RESPONSE AS FOLLOWS:`,
    `1. 🎬 Video Overview & Core Topic (What the video covers, the instructor's main objective, and why it matters)`,
    `2. ⏱️ Key Milestones & Timestamps (List important concepts with their approximate timestamps in the video, e.g. [02:15] – Concept Name)`,
    `3. 🔍 Core Concepts & Step-by-Step Breakdown (Detailed explanation of definitions, formulas, demonstrations, diagrams, or examples shown in the video)`,
    `4. 💡 Summary & Study Takeaways (A concise wrap-up with a memory hook or rule of thumb for revision)`,
    `\nACCURACY & ACCESSIBILITY GUIDELINES:`,
    `- Ground your explanation STRICTLY in the actual content taught and shown in the video.`,
    `- Do NOT invent unseen content, false examples, or inaccurate timestamps.`,
    `- NEVER wrap regular non-math words, headings, or bullet items in dollar signs ($). Only use math formatting ($...$ or $$...$$) for actual mathematical formulas or equations.`,
    `- When describing processes, sequences, or cycles, use clear visual arrow symbols (→, ←, ↑, ↓) instead of words like "arrow" or "yields".`,
    `- Include a brief friendly note at the beginning reminding the student: "✨ *AI-generated study material grounded in video content. AI summaries may contain errors—please review and edit in the workspace before studying.*"`,
  ];

  const fullPrompt = promptParts.join('\n\n');

  // Verified candidate models with active quota:
  // Primary: gemini-3.5-flash-lite (24/500 RPD free-tier quota)
  // Fallback: gemini-3.5-flash
  // Exhausted models (gemini-3.8-flash, gemini-3.6-flash, gemini-flash-latest) are explicitly excluded
  const configuredModel = process.env.GEMINI_VIDEO_MODEL?.trim();
  const candidateModels = configuredModel
    ? [configuredModel]
    : ['gemini-3.5-flash-lite', 'gemini-3.5-flash'];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            fileData: {
              fileUri: canonicalUrl,
              mimeType: 'video/mp4',
            },
          },
          { text: fullPrompt },
        ],
      });

      const rawText = response.text || '';
      if (!rawText.trim()) {
        continue;
      }

      // Format markdown for display (strips stray dollar signs, preserves math and arrows)
      const cleanText = formatExplanationForDisplay(rawText);

      return {
        success: true,
        text: cleanText,
        canonicalUrl,
        modelUsed: model,
        warning: 'AI-generated explanation grounded in video content. Please review and edit before studying.',
      };
    } catch (err: any) {
      lastError = err;
      const errorMsg = String(err?.message || err);
      const status = err?.status || err?.code;

      // Check for permission denied (e.g. private, unlisted, age-restricted, or deleted video)
      if (status === 403 || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('caller does not have permission')) {
        return {
          success: false,
          error: 'YouTube video cannot be accessed',
          details:
            'This video is private, unlisted, age-restricted, or region-blocked. Google Gemini can only analyze publicly accessible YouTube videos. You can copy the transcript (e.g. from YouTube\'s "Show Transcript" button) and paste it below instead.',
        };
      }

      // Check for quota exhaustion (8 hours/day free-tier video limit or rate limit)
      if (status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return {
          success: false,
          error: 'Daily video analysis limit reached',
          details:
            'The daily free-tier video understanding limit (up to 8 hours per day) has been reached. You can still study this video immediately by copying its transcript or subtitles and pasting it into the field below.',
        };
      }

      // If temporary 503 or model error, loop to next candidate model
      continue;
    }
  }

  // If all candidate models failed
  const finalMsg = lastError?.message || 'Failed to process YouTube video.';
  return {
    success: false,
    error: 'Video analysis failed',
    details: `Unable to analyze this video directly (${finalMsg}). Please copy the video transcript or subtitle text and paste it into the workspace below.`,
  };
}
