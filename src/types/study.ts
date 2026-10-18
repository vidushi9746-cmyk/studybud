export type SupportedLanguage = 'English' | 'Hindi' | 'Kannada' | 'Hinglish';

export type MaterialSourceType = 'text' | 'pdf' | 'image' | 'video' | 'audio';

export interface ExtractedMaterial {
  sourceType: MaterialSourceType;
  sourceName?: string;
  text: string;
  pageCount?: number;
  description?: string; // Accessible description for images/diagrams
  isScannedPdf?: boolean;
  warning?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  concept: string;
  explanation: string;
}

export interface MissedQuestionDetail {
  questionId: number;
  question: string;
  selectedOption: string;
  correctOption: string;
  concept: string;
  explanation: string;
}

export interface QuizSubmissionResult {
  score: number;
  total: number;
  percentage: number;
  missedQuestions: MissedQuestionDetail[];
  identifiedWeakConcepts: string[];
}

export interface QuizHistoryItem {
  id: string;
  timestamp: number;
  materialTitle: string;
  score: number;
  total: number;
  percentage: number;
  weakConcepts: string[];
}

export interface StudySessionItem {
  id: string;
  timestamp: number;
  materialSnippet: string;
  question?: string;
  language: SupportedLanguage;
  simpleLanguage: boolean;
  explanationSnippet: string;
}

export interface WeakConceptEntry {
  concept: string;
  count: number;
  lastMissedAt: number;
}

export interface StudyApiRequest {
  action: 'explain' | 'quiz' | 'revise' | 'health';
  material?: string;
  question?: string;
  language?: SupportedLanguage;
  simpleLanguage?: boolean;
  weakConcepts?: string[];
  missedQuestions?: Array<{
    question: string;
    selectedOption: string;
    correctOption: string;
    concept: string;
    explanation?: string;
  }>;
}

export interface StudyApiResponse {
  success: boolean;
  action: 'explain' | 'quiz' | 'revise' | 'health';
  model?: string;
  explanation?: string;
  quiz?: QuizQuestion[];
  revision?: string;
  weakConceptsAddressed?: string[];
  error?: string;
  details?: string;
}

export interface ExtractApiRequest {
  type: 'pdf' | 'image' | 'video_url' | 'audio';
  fileBase64?: string;
  mimeType?: string;
  fileName?: string;
  videoUrl?: string;
  transcriptText?: string;
  language?: SupportedLanguage;
  simpleLanguage?: boolean;
}

export interface ExtractApiResponse {
  success: boolean;
  sourceType: MaterialSourceType;
  sourceName?: string;
  text: string;
  description?: string;
  pageCount?: number;
  isScannedPdf?: boolean;
  warning?: string;
  error?: string;
  details?: string;
}
