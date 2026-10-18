import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { QuizQuestion, StudyApiRequest, SupportedLanguage } from '@/types/study';
import { formatExplanationForDisplay } from '@/lib/explanationFormatter';

const FORMATTING_REQUIREMENTS = [
  'FORMATTING & ACCESSIBILITY REQUIREMENTS:',
  '- When describing processes, chemical equations, workflows, or sequences, ALWAYS use standard visual arrow symbols (→, ←, ↑, ↓) instead of words like "arrow" or "yields" and avoid ASCII arrows (->, -->). For example: write "Sunlight → Chlorophyll → Glucose", "Price ↑ → Demand ↓".',
  '- NEVER wrap ordinary non-math words, headings, bullet items, or concepts in dollar signs ($). Write "Photosynthesis" NOT "$Photosynthesis$", write "### 1. Core Idea" NOT "### $1. Core Idea$".',
  '- Use math delimiters ($...$ or $$...$$) ONLY for actual mathematical formulas, equations, or scientific variables (e.g. $F = ma$, $$Q_s = 20 + 2P$$).',
  '- Write prices and currency with standard notation followed immediately by digits (e.g. $50, $100), not as LaTeX math.',
].join('\n');

// Safe server-side environment reading
function getEnvConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMMA_MODEL?.trim() || 'gemma-4-26b-a4b-it';
  return { apiKey, modelName };
}

// Build language instruction for Gemma
function getLanguagePromptInstruction(lang: SupportedLanguage = 'English'): string {
  switch (lang) {
    case 'Hindi':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain completely in clear, natural Hindi (हिन्दी) using Devanagari script, keeping essential scientific/technical terms in parentheses.';
    case 'Kannada':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain completely in clear, accessible Kannada (ಕನ್ನಡ) script, keeping essential scientific/technical terms in parentheses.';
    case 'Hinglish':
      return 'IMPORTANT LANGUAGE REQUIREMENT: Explain in conversational Hinglish (a natural, friendly blend of Hindi and English written in the Latin alphabet, widely spoken by students in India), e.g. "Photosynthesis ek aisa process hai jisme plants sunlight ka use karke apna food banate hain."';
    case 'English':
    default:
      return 'Explain in clear, standard English with student-friendly vocabulary.';
  }
}

// Helper to safely extract JSON from model response
function parseQuizJson(rawText: string): QuizQuestion[] {
  let cleaned = rawText.trim();
  // Strip markdown code block if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sanitizeQuizQuestions(parsed);
    }
  } catch {
    // If direct parse fails, try extracting array via regex
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeQuizQuestions(parsed);
        }
      } catch {
        // Fall through
      }
    }
  }

  throw new Error('Unable to parse generated quiz into the expected format. Please try generating the quiz again.');
}

function sanitizeQuizQuestions(items: unknown[]): QuizQuestion[] {
  return items.slice(0, 5).map((item: any, idx) => {
    const rawOptions = Array.isArray(item.options) ? item.options : ['Option A', 'Option B', 'Option C', 'Option D'];
    const options = rawOptions.slice(0, 4).map(String);
    while (options.length < 4) {
      options.push(`Option ${String.fromCharCode(65 + options.length)}`);
    }

    let correctIndex = typeof item.correctAnswerIndex === 'number' ? item.correctAnswerIndex : 0;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    return {
      id: typeof item.id === 'number' ? item.id : idx + 1,
      question: String(item.question || `Question ${idx + 1}`),
      options,
      correctAnswerIndex: correctIndex,
      concept: String(item.concept || 'General Concept'),
      explanation: String(item.explanation || 'Refer back to the study material for details.'),
    };
  });
}

// Quota-resilient content generator with verified fallback to gemini-3.5-flash-lite
async function generateContentWithQuotaResilience(
  ai: GoogleGenAI,
  primaryModel: string,
  contents: any,
  config?: any
): Promise<{ text: string; modelUsed: string }> {
  try {
    const res = await ai.models.generateContent({
      model: primaryModel,
      contents,
      ...(config ? { config } : {}),
    });
    return { text: res.text || '', modelUsed: primaryModel };
  } catch (primaryErr: any) {
    const errorMsg = String(primaryErr?.message || primaryErr);
    const status = primaryErr?.status || primaryErr?.code;

    // Check if error is quota / TPM / rate limit (429 or RESOURCE_EXHAUSTED) or temporary capacity (503)
    const isRateOrQuotaError = status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429');
    const isTemporaryError = status === 503 || errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');

    const fallbackModel = 'gemini-3.5-flash-lite';
    if ((isRateOrQuotaError || isTemporaryError) && primaryModel !== fallbackModel) {
      try {
        const fallbackRes = await ai.models.generateContent({
          model: fallbackModel,
          contents,
          ...(config ? { config } : {}),
        });
        return { text: fallbackRes.text || '', modelUsed: fallbackModel };
      } catch (fallbackErr: any) {
        throw fallbackErr;
      }
    }

    throw primaryErr;
  }
}

// GET Handler - Health and configuration check
export async function GET() {
  const { apiKey, modelName } = getEnvConfig();

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      action: 'health',
      isConfigured: false,
      model: modelName,
      error: 'GEMINI_API_KEY is not configured in server environment (.env.local).',
    });
  }

  return NextResponse.json({
    success: true,
    action: 'health',
    isConfigured: true,
    model: modelName,
    supportedLanguages: ['English', 'Hindi', 'Kannada', 'Hinglish'],
  });
}

// POST Handler
export async function POST(req: Request) {
  const { apiKey, modelName } = getEnvConfig();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing API Key',
        details: 'GEMINI_API_KEY is not set on the server. Please check your .env.local file.',
      },
      { status: 500 }
    );
  }

  let body: StudyApiRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload in request body.' },
      { status: 400 }
    );
  }

  const { action, material, question, language = 'English', simpleLanguage = false, weakConcepts = [], missedQuestions = [] } = body;

  if (action === 'health') {
    return NextResponse.json({
      success: true,
      action: 'health',
      isConfigured: true,
      model: modelName,
    });
  }

  if (!material || material.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Study material is required.' },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const langInstruction = getLanguagePromptInstruction(language);

  try {
    // -------------------------------------------------------------
    // ACTION 1: EXPLAIN
    // -------------------------------------------------------------
    if (action === 'explain') {
      const promptParts = [
        `You are StudyBud, a warm, encouraging, accessibility-first AI tutor powered by Gemma.`,
        `Your mission is to help students truly understand concepts without feeling overwhelmed.`,
        langInstruction,
        simpleLanguage
          ? `SIMPLIFIED MODE (Explain Like I'm 10): Use vivid real-world analogies, straightforward everyday vocabulary, brief sentences, and conversational clarity. Avoid intimidating academic jargon unless immediately defined with an intuitive metaphor.`
          : `STANDARD ACCESSIBLE MODE: Provide a well-structured, clear explanation with bullet points, bold key terms, and intuitive summaries.`,
        FORMATTING_REQUIREMENTS,
      ];

      if (weakConcepts.length > 0) {
        promptParts.push(
          `ADAPTIVE LEARNING NOTE: The student previously struggled with these specific concepts: "${weakConcepts.join(', ')}". Gently and explicitly highlight or connect these concepts in your explanation to help bridge their understanding.`
        );
      }

      if (question && question.trim().length > 0) {
        promptParts.push(`STUDENT'S SPECIFIC QUESTION OR FOCUS: "${question.trim()}". Make sure to prioritize addressing this question directly.`);
      }

      promptParts.push(
        `STUDY MATERIAL TO BASE EXPLANATION ON:`,
        material.trim(),
        `\nStructure your response with:`,
        `1. 🌟 Core Idea in One Sentence`,
        `2. 🔍 Step-by-Step Breakdown (use analogies/examples)`,
        `3. 💡 Key Takeaway / Quick Memory Hook`
      );

      const { text: rawExplanation, modelUsed: usedModel } = await generateContentWithQuotaResilience(
        ai,
        modelName,
        promptParts.join('\n\n')
      );

      const cleanExplanation = formatExplanationForDisplay(rawExplanation || 'No explanation generated.');

      return NextResponse.json({
        success: true,
        action: 'explain',
        model: usedModel,
        explanation: cleanExplanation,
        weakConceptsAddressed: weakConcepts,
      });
    }

    // -------------------------------------------------------------
    // ACTION 2: QUIZ GENERATION
    // -------------------------------------------------------------
    if (action === 'quiz') {
      const quizPromptParts = [
        `You are StudyBud's assessment generator powered by Gemma.`,
        `Create a 5-question multiple-choice quiz STRICTLY grounded in the provided study material.`,
        langInstruction,
        `Requirements for the quiz:`,
        `- Exactly 5 multiple-choice questions.`,
        `- Each question must have exactly 4 choices (options).`,
        `- One single unambiguous correct choice (correctAnswerIndex: 0, 1, 2, or 3).`,
        `- Identify the specific core "concept" being tested (e.g., "Thylakoid Membrane Function", "Inertia", "RuBisCO Role").`,
        `- Include a friendly "explanation" for why the correct option is right and what common pitfall to avoid.`,
      ];

      if (weakConcepts.length > 0) {
        quizPromptParts.push(
          `ADAPTIVE FOCUS: The student previously missed questions on: "${weakConcepts.join(', ')}". Include at least 2 questions targeting these concepts to verify improvement.`
        );
      }

      quizPromptParts.push(
        `STUDY MATERIAL:`,
        material.trim(),
        `\nOUTPUT FORMAT:`,
        `Respond ONLY with a JSON array conforming to this structure:`,
        `[`,
        `  {`,
        `    "id": 1,`,
        `    "question": "string",`,
        `    "options": ["Option A", "Option B", "Option C", "Option D"],`,
        `    "correctAnswerIndex": 0,`,
        `    "concept": "Name of concept",`,
        `    "explanation": "Why this answer is correct..."`,
        `  }`,
        `]`
      );

      let responseText = '';
      let usedModel = modelName;
      try {
        const res = await generateContentWithQuotaResilience(
          ai,
          modelName,
          quizPromptParts.join('\n\n'),
          { responseMimeType: 'application/json' }
        );
        responseText = res.text;
        usedModel = res.modelUsed;
      } catch {
        // Fallback without responseMimeType in case of variation
        const res = await generateContentWithQuotaResilience(
          ai,
          modelName,
          quizPromptParts.join('\n\n')
        );
        responseText = res.text;
        usedModel = res.modelUsed;
      }

      const questions = parseQuizJson(responseText);

      return NextResponse.json({
        success: true,
        action: 'quiz',
        model: usedModel,
        quiz: questions,
      });
    }

    // -------------------------------------------------------------
    // ACTION 3: ADAPTIVE REVISION
    // -------------------------------------------------------------
    if (action === 'revise') {
      const revisionPromptParts = [
        `You are StudyBud's Adaptive Revision Coach powered by Gemma.`,
        `A student recently completed a quiz on this study material and got certain questions wrong.`,
        `Your task is to provide a fresh, alternative explanation specifically for the concepts they missed.`,
        `DO NOT just repeat the original textbook definitions. Use a COMPLETELY DIFFERENT pedagogical angle:`,
        `- Diagnose why students commonly make this specific mistake (the misconception).`,
        `- Use a fresh, vivid real-world analogy or memory trick (mnemonic).`,
        `- Break down the confusion step by step.`,
        `- Give a quick check-in puzzle or self-test question at the end for the student to confirm mastery.`,
        langInstruction,
        simpleLanguage
          ? `Use extra-simple language, visual metaphors, and conversational warmth.`
          : `Use clear, encouraging, structured explanations.`,
        FORMATTING_REQUIREMENTS,
      ];

      if (weakConcepts.length > 0) {
        revisionPromptParts.push(
          `MISSED CONCEPTS TO TARGET:`,
          weakConcepts.map((c) => `- ${c}`).join('\n')
        );
      }

      if (missedQuestions.length > 0) {
        revisionPromptParts.push(
          `SPECIFIC QUIZ MISTAKES:`,
          missedQuestions
            .map(
              (m, i) =>
                `Mistake ${i + 1}:\n- Question: ${m.question}\n- Concept: ${m.concept}\n- What student selected: ${m.selectedOption}\n- Correct answer: ${m.correctOption}\n- Why it is right: ${m.explanation || ''}`
            )
            .join('\n\n')
        );
      }

      revisionPromptParts.push(
        `ORIGINAL STUDY MATERIAL REFERENCE:`,
        material.trim(),
        `\nStructure your revision as:`,
        `1. 🎯 What Got Mixed Up (Explain the misconception gently)`,
        `2. 💡 The "Aha!" Analogy (A new relatable mental picture)`,
        `3. 🔑 Memory Hook / Rule of Thumb to never forget`,
        `4. ⚡ Quick Check-in Question (with answer hidden/revealed at the end)`
      );

      const { text: rawRevision, modelUsed: usedModel } = await generateContentWithQuotaResilience(
        ai,
        modelName,
        revisionPromptParts.join('\n\n')
      );

      const cleanRevision = formatExplanationForDisplay(rawRevision || 'No revision generated.');

      return NextResponse.json({
        success: true,
        action: 'revise',
        model: usedModel,
        revision: cleanRevision,
        weakConceptsAddressed: weakConcepts,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: "${action}"` },
      { status: 400 }
    );
  } catch (err: any) {
    const errorMessage = err?.message || 'An error occurred while communicating with the study model.';
    const isQuota =
      err?.status === 429 ||
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('quota');

    if (isQuota) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI Study Assistant is momentarily busy (Rate limit reached)',
          details:
            'Google AI Studio free-tier capacity or rate limits have been reached. Your study text is safely preserved in the workspace—please wait 20-30 seconds and try again.',
          retryAfterSeconds: 30,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Study API Error',
        details: errorMessage,
      },
      { status: 502 }
    );
  }
}
