# StudyBud 🌱


## 🚀 Live Demo

**Try StudyBud here:** [https://studybud-gules.vercel.app](https://studybud-gules.vercel.app)

**StudyBud** is an accessibility-first adaptive learning companion powered by **Gemma 4** (`gemma-4-26b-a4b-it`) and Google's official multimodal models via `@google/genai`, built with **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS**.

StudyBud transforms static lecture notes, textbook diagrams, PDFs, and video/audio transcripts into an interactive, multi-sensory learning experience:

1. **Unified Multimodal Material Input**:
   - **Pasted Text**: Paste lecture notes or load curated sample lessons (e.g., Photosynthesis or Newton's Laws).
   - **PDF Uploads**: Fast extraction of digital text with page preservation (`unpdf`), plus automated Gemma 4 OCR fallback for scanned or image-only PDFs (up to 20MB).
   - **Images & Diagrams**: Upload diagrams, textbook illustrations, or handwritten notes. Gemma 4 provides an accessible visual alt-text description and extracts readable labels and text (up to 10MB).
   - **Video Lectures**: Enter video URLs, view caption accessibility status, and review or paste subtitle transcripts.
   - **Audio/Video Transcription**: Native lecture-audio speech transcription powered by Google's `gemini-3.5-transcribe` under the official free tier (WAV, MP3, M4A, WebM up to 15MB) using your existing `GEMINI_API_KEY`.
   - **Reviewable Text**: Students can review and edit all extracted text before studying.

2. **Accessible Explanations**:
   - Structured explanations in English, Hindi (हिन्दी), Kannada (ಕನ್ನಡ), or conversational Hinglish.
   - Optional **"Explain Simply" (ELI5)** mode using relatable everyday metaphors.

3. **Browser Text-to-Speech (TTS)**:
   - Cleaned speech output that strips emojis, decorative pictographs, and Markdown syntax while preserving words, numbered steps, and mathematical expressions.
   - Adjustable reading speeds (0.8x, 1.0x, 1.25x) and localized voices.

4. **Voice Question Input**:
   - Native Web Speech API integration allows students to dictate questions in their selected language with real-time editing before submission.

5. **Knowledge Check Quizzes**:
   - Automatically generates 5-question multiple-choice quizzes grounded directly in the provided material, identifying specific concepts for each question.

6. **Personalized Adaptive Revision**:
   - Diagnoses concepts missed during quizzes and generates a targeted masterclass with fresh analogies, memory hooks, and self-check questions.

7. **Privacy-Conscious Local Storage**:
   - Quiz history, weak concepts, and preferences are stored exclusively on the student's device (`localStorage`).

---

## Audio Transcription & Google Free-Tier Details

### Model: `models/gemini-3.5-transcribe`
- **Supported Actions**: `['generateContent', 'countTokens']`
- **Context Limit**: 98,304 tokens
- **Modalities**: Audio (WAV, MP3, M4A, AAC, WebM, OGG) + Text
- **Free Tier Eligibility**: Zero-cost free-tier access via Google AI Studio using standard API keys. Does not require a paid billing account or credit card.
- **Performance**: Real speech transcribed verbatim in ~2.0 to 2.8 seconds on 25KB–220KB clips.

### Documented Free-Tier Quotas & Limits
- **Requests Per Minute (RPM)**: 10 to 15 RPM
- **Requests Per Day (RPD)**: 500 to 1,500 RPD (resets at midnight Pacific Time)
- **Tokens Per Minute (TPM)**: ~250,000 to 1,000,000 TPM (Audio consumes ~25 tokens/sec or ~1,500 tokens/min)
- **Official Documentation**:
  - [Google AI Studio Pricing](https://ai.google.dev/pricing)
  - [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)

### Hackathon Demo Assessment & Safeguards
- **Sufficiency**: More than adequate for live hackathon demos with multiple students uploading 1–3 minute clips.
- **Safeguards**:
  - 15MB file-size limit enforced before processing.
  - Automatic fallback to manual transcript pasting and subtitle ingestion if free-tier rate limits (HTTP 429) are encountered.
  - Transparent error reporting for silent or corrupted recordings.

---

## Architecture & Tech Stack

- **Framework**: Next.js 16.4 (App Router) + React 19
- **Model & SDK**: Google Gemma 4 (`gemma-4-26b-a4b-it`) + Gemini 3.5 Transcribe (`gemini-3.5-transcribe`) via `@google/genai`
- **Multimodal Extraction**:
  - `unpdf` with page boundary preservation and Gemma 4 OCR fallback
  - Gemma 4 Multimodal Vision for diagram descriptions and handwritten text OCR
  - Native Gemini 3.5 audio transcription
- **Styling**: Tailwind CSS v4 with warm student-friendly theme, font scaling, and high-contrast support
- **Audio & Accessibility**:
  - Native Web Speech API (`SpeechSynthesis` for read-aloud, `SpeechRecognition` for voice questions)
  - Dedicated speech cleaner (`cleanTextForSpeech`) stripping emojis and Markdown syntax

---

## Getting Started

### 1. Prerequisites
- Node.js 20+ installed
- A Google Gemini / Gemma API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Environment Configuration
Copy the example environment configuration file:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Google Gemini / Gemma API Key (server-side only)
GEMINI_API_KEY=your_gemini_api_key_here

# Gemma 4 Model ID for explanations and quizzes
GEMMA_MODEL=gemma-4-26b-a4b-it
```

### 3. Install Dependencies & Run
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to begin learning.

### 4. Production Build
```bash
npm run build
npm run start
```

---

## API Endpoints

- **`POST /api/extract`**:
  - `type: "pdf"`: Extracts embedded text with page numbers; invokes Gemma 4 OCR if the document is scanned.
  - `type: "image"`: Uses Gemma 4 vision to describe diagrams, shapes, labels, and OCR text.
  - `type: "video_url"`: Validates URL and manages transcript inputs.
  - `type: "audio"`: Transcribes audio using Google's `gemini-3.5-transcribe` on the free tier.
- **`POST /api/study`**:
  - `action: "explain"`: Generates accessible explanations tailored to language, simplicity mode, and weak concepts.
  - `action: "quiz"`: Produces 5 grounded multiple-choice questions with concepts and explanations.
  - `action: "revise"`: Delivers targeted remediation for missed concepts.
  - `action: "health"`: Returns model status without exposing keys.
- **`GET /api/study`**: Configuration and connectivity check.

---

## Accessibility Features

- **Font Size Scaling**: Standard (1x), Large (1.2x), Extra Large (1.4x).
- **High Contrast Mode**: Compliant with WCAG AAA recommendations.
- **Dyslexia-Friendly Spacing**: Enhanced letter spacing and relaxed line height.
- **Speech Synthesis (TTS)**: Clean audio reading without reading emojis or formatting symbols aloud.
- **Voice Recognition (STT)**: Microphone question input matching student language preference.
- **Keyboard Navigation & ARIA**: Visible focus rings (`focus-visible:ring-amber-500`) and live announcements.
