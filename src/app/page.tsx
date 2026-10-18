'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Volume2,
  Brain,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ClipboardPaste,
  Globe,
  Sliders,
  History,
  FileText,
  Lightbulb,
} from 'lucide-react';
import Header from '@/components/Header';
import TextToSpeech from '@/components/TextToSpeech';
import QuizPlayer from '@/components/QuizPlayer';
import RevisionSection from '@/components/RevisionSection';
import ProgressSection from '@/components/ProgressSection';
import UnifiedMaterialInput from '@/components/UnifiedMaterialInput';
import VoiceQuestionInput from '@/components/VoiceQuestionInput';
import { SAMPLE_LESSONS } from '@/lib/sampleLessons';
import { formatExplanationForDisplay } from '@/lib/explanationFormatter';
import {
  loadStoredPreferences,
  saveStoredPreferences,
  getStoredWeakConcepts,
  recordMissedConcepts,
  removeStoredWeakConcept,
  clearStoredWeakConcepts,
  getStoredQuizHistory,
  saveQuizHistoryRecord,
  getStoredStudyHistory,
  saveStudySessionRecord,
  clearAllLocalLearningData,
  UserPreferences,
  DEFAULT_PREFERENCES,
} from '@/lib/storage';
import {
  QuizQuestion,
  QuizSubmissionResult,
  QuizHistoryItem,
  StudySessionItem,
  SupportedLanguage,
  WeakConceptEntry,
  StudyApiResponse,
  ExtractedMaterial,
} from '@/types/study';

export default function StudyBudHome() {
  // Client hydration safe state
  const [isClient, setIsClient] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [modelName, setModelName] = useState<string>('gemma-4-26b-a4b-it');
  const [isModelReady, setIsModelReady] = useState<boolean>(false);

  // Form inputs & multimodal metadata
  const [material, setMaterial] = useState<string>('');
  const [extractedMeta, setExtractedMeta] = useState<ExtractedMaterial | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [language, setLanguage] = useState<SupportedLanguage>('English');
  const [simpleLanguage, setSimpleLanguage] = useState<boolean>(false);

  // API State
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [isRevising, setIsRevising] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Outputs
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationWeakConcepts, setExplanationWeakConcepts] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [revisionContent, setRevisionContent] = useState<string | null>(null);
  const [revisionConcepts, setRevisionConcepts] = useState<string[]>([]);

  // Persistent user learning data
  const [weakConcepts, setWeakConcepts] = useState<WeakConceptEntry[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudySessionItem[]>([]);

  // Active section tab: 'workspace' | 'progress'
  const [activeTab, setActiveTab] = useState<'workspace' | 'progress'>('workspace');

  // References for scrolling
  const explanationRef = useRef<HTMLDivElement>(null);
  const quizRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef<HTMLDivElement>(null);

  // Initial load: safely pull from localStorage and check backend health
  useEffect(() => {
    setIsClient(true);
    const prefs = loadStoredPreferences();
    setPreferences(prefs);
    setLanguage(prefs.language);
    setSimpleLanguage(prefs.simpleLanguage);
    setWeakConcepts(getStoredWeakConcepts());
    setQuizHistory(getStoredQuizHistory());
    setStudyHistory(getStoredStudyHistory());

    // Apply accessibility settings to HTML root
    document.documentElement.setAttribute('data-font-size', prefs.fontSize);
    document.documentElement.setAttribute('data-dyslexic', String(prefs.dyslexicFont));
    if (prefs.highContrast) {
      document.documentElement.setAttribute('data-contrast', 'high');
    } else {
      document.documentElement.removeAttribute('data-contrast');
    }

    // Health check with server
    fetch('/api/study')
      .then((res) => res.json())
      .then((data) => {
        if (data.model) setModelName(data.model);
        if (data.isConfigured) setIsModelReady(true);
      })
      .catch(() => {
        setIsModelReady(false);
      });
  }, []);

  // Update user preferences helper
  const handleUpdatePreferences = (updates: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...updates };
    setPreferences(updated);
    saveStoredPreferences(updated);

    if (updates.fontSize) {
      document.documentElement.setAttribute('data-font-size', updates.fontSize);
    }
    if (typeof updates.dyslexicFont === 'boolean') {
      document.documentElement.setAttribute('data-dyslexic', String(updates.dyslexicFont));
    }
    if (typeof updates.highContrast === 'boolean') {
      if (updates.highContrast) {
        document.documentElement.setAttribute('data-contrast', 'high');
      } else {
        document.documentElement.removeAttribute('data-contrast');
      }
    }
    if (updates.language) {
      setLanguage(updates.language);
    }
    if (typeof updates.simpleLanguage === 'boolean') {
      setSimpleLanguage(updates.simpleLanguage);
    }
  };

  // Load a sample lesson
  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_LESSONS.find((s) => s.id === sampleId) || SAMPLE_LESSONS[0];
    setMaterial(sample.content);
    setQuestion(sample.suggestedQuestion);
    setExtractedMeta({
      sourceType: 'text',
      sourceName: `${sample.emoji} ${sample.title}`,
      text: sample.content,
    });
    setApiError(null);
  };

  // Handle Explain Action
  const handleExplain = async () => {
    if (!material.trim()) {
      setApiError('Please enter or paste your study material first.');
      return;
    }

    setIsExplaining(true);
    setApiError(null);
    setExplanation(null);
    setQuizQuestions(null);
    setRevisionContent(null);

    const relevantWeakConcepts = weakConcepts.map((w) => w.concept);

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explain',
          material,
          question,
          language,
          simpleLanguage,
          weakConcepts: relevantWeakConcepts,
        }),
      });

      const data: StudyApiResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to generate explanation');
      }

      setExplanation(data.explanation || '');
      setExplanationWeakConcepts(data.weakConceptsAddressed || []);

      // Record study history item
      const historyItem: StudySessionItem = {
        id: `study-${Date.now()}`,
        timestamp: Date.now(),
        materialSnippet: material.slice(0, 120) + '...',
        question: question.trim() || undefined,
        language,
        simpleLanguage,
        explanationSnippet: (data.explanation || '').slice(0, 160) + '...',
      };
      saveStudySessionRecord(historyItem);
      setStudyHistory(getStoredStudyHistory());

      setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setApiError(err.message || 'Error communicating with Gemma. Please try again.');
    } finally {
      setIsExplaining(false);
    }
  };

  // Handle Generate Quiz Action
  const handleGenerateQuiz = async () => {
    if (!material.trim()) {
      setApiError('Please provide study material to generate a quiz.');
      return;
    }

    setIsGeneratingQuiz(true);
    setApiError(null);
    setQuizQuestions(null);
    setRevisionContent(null);

    const relevantWeakConcepts = weakConcepts.map((w) => w.concept);

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quiz',
          material,
          language,
          weakConcepts: relevantWeakConcepts,
        }),
      });

      const data: StudyApiResponse = await res.json();

      if (!res.ok || !data.success || !data.quiz) {
        throw new Error(data.details || data.error || 'Failed to generate quiz');
      }

      setQuizQuestions(data.quiz);

      setTimeout(() => {
        quizRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setApiError(err.message || 'Error generating quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Callback when a quiz is submitted
  const handleQuizComplete = (result: QuizSubmissionResult) => {
    // 1. Record any missed concepts into local storage
    if (result.identifiedWeakConcepts.length > 0) {
      const updatedWeak = recordMissedConcepts(result.identifiedWeakConcepts);
      setWeakConcepts(updatedWeak);
    }

    // 2. Save quiz attempt into history
    const historyItem: QuizHistoryItem = {
      id: `quiz-${Date.now()}`,
      timestamp: Date.now(),
      materialTitle: material.split('\n')[0].slice(0, 60) || 'Study Session Material',
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      weakConcepts: result.identifiedWeakConcepts,
    };
    saveQuizHistoryRecord(historyItem);
    setQuizHistory(getStoredQuizHistory());
  };

  // Trigger Adaptive Revision
  const handleRequestRevision = async (
    missedConcepts: string[],
    missedQuestions: QuizSubmissionResult['missedQuestions']
  ) => {
    setIsRevising(true);
    setApiError(null);
    setRevisionConcepts(missedConcepts);

    try {
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revise',
          material,
          language,
          simpleLanguage,
          weakConcepts: missedConcepts,
          missedQuestions,
        }),
      });

      const data: StudyApiResponse = await res.json();

      if (!res.ok || !data.success || !data.revision) {
        throw new Error(data.details || data.error || 'Failed to generate adaptive revision');
      }

      setRevisionContent(data.revision);

      setTimeout(() => {
        revisionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setApiError(err.message || 'Error generating revision.');
    } finally {
      setIsRevising(false);
    }
  };

  // Mark concepts as mastered
  const handleMarkMastered = (concepts: string[]) => {
    let current = weakConcepts;
    concepts.forEach((c) => {
      current = removeStoredWeakConcept(c);
    });
    setWeakConcepts(current);
  };

  // Clear single weak concept
  const handleRemoveWeakConcept = (concept: string) => {
    const updated = removeStoredWeakConcept(concept);
    setWeakConcepts(updated);
  };

  // Clear all local data
  const handleClearAllData = () => {
    if (confirm('Clear all local quiz history and weak concepts from this browser?')) {
      clearAllLocalLearningData();
      setWeakConcepts([]);
      setQuizHistory([]);
      setStudyHistory([]);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="flex items-center gap-3 text-amber-900 font-medium">
          <span className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          Loading StudyBud...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      <Header
        modelName={modelName}
        isModelReady={isModelReady}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <nav className="flex items-center gap-2" aria-label="StudyBud main navigation">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'workspace'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Study Workspace
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('progress')}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'progress'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <History className="w-4 h-4" />
              Learning Progress & History
              {weakConcepts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white">
                  {weakConcepts.length}
                </span>
              )}
            </button>
          </nav>

          {/* Quick sample lesson trigger */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Try Sample:</span>
            <button
              type="button"
              onClick={() => handleLoadSample('photosynthesis')}
              className="px-2.5 py-1 rounded-xl text-xs font-medium bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50 transition-colors"
            >
              🌿 Photosynthesis
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('newton-laws')}
              className="px-2.5 py-1 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-300/50 transition-colors"
            >
              🍎 Newton&apos;s Laws
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {apiError && (
          <div
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-3 shadow-sm"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Notice</span>
              {apiError}
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* MAIN TAB CONTENT */}
        {activeTab === 'progress' ? (
          <ProgressSection
            weakConcepts={weakConcepts}
            quizHistory={quizHistory}
            studyHistory={studyHistory}
            onRemoveWeakConcept={handleRemoveWeakConcept}
            onClearAllData={handleClearAllData}
          />
        ) : (
          <div className="space-y-8">
            {/* 1. INPUT WORKSPACE CARD */}
            <section
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm transition-all"
              aria-labelledby="workspace-heading"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2
                    id="workspace-heading"
                    className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"
                  >
                    <FileText className="w-5 h-5 text-amber-500" />
                    Enter Study Material
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Paste lecture notes, textbook chapters, or an article. StudyBud explains concepts and personalizes based on your history.
                  </p>
                </div>

                {/* Mobile sample buttons */}
                <div className="flex sm:hidden items-center gap-1.5 self-start">
                  <span className="text-[11px] text-zinc-500">Sample:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('photosynthesis')}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-amber-100 text-amber-900"
                  >
                    🌿 Photosynthesis
                  </button>
                </div>
              </div>

              {/* Multimodal Unified Material Input */}
              <UnifiedMaterialInput
                material={material}
                onMaterialChange={setMaterial}
                extractedMeta={extractedMeta}
                onExtractedMetaChange={setExtractedMeta}
                onLoadSample={handleLoadSample}
                language={language}
                simpleLanguage={simpleLanguage}
              />

              {/* Voice Question Input */}
              <div className="pt-1">
                <VoiceQuestionInput
                  value={question}
                  onChange={setQuestion}
                  language={language}
                  id="study-question-input"
                  placeholder="e.g. What is the difference between light reactions and the Calvin cycle?"
                />
              </div>

              {/* Study Preferences Bar (Language & Simple-Language Toggle) */}
              <div className="mt-5 pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Language Selector */}
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-zinc-500" />
                    <label htmlFor="language-select" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Language:
                    </label>
                    <select
                      id="language-select"
                      value={language}
                      onChange={(e) => {
                        const newLang = e.target.value as SupportedLanguage;
                        setLanguage(newLang);
                        handleUpdatePreferences({ language: newLang });
                      }}
                      className="text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="English">English</option>
                      <option value="Hindi">हिन्दी (Hindi)</option>
                      <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                      <option value="Hinglish">Hinglish (Hindi-English blend)</option>
                    </select>
                  </div>

                  {/* Simple Language Toggle (ELI5) */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={simpleLanguage}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setSimpleLanguage(val);
                        handleUpdatePreferences({ simpleLanguage: val });
                      }}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-zinc-300 dark:border-zinc-700"
                    />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      Simple Explanations (ELI5 Mode)
                    </span>
                  </label>
                </div>

                {/* Action Buttons: Explain & Generate Quiz */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz || isExplaining || !material.trim()}
                    className="px-4 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        Generating Quiz...
                      </>
                    ) : (
                      <>
                        <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                        Generate Quiz
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExplain}
                    disabled={isExplaining || isGeneratingQuiz || !material.trim()}
                    className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    {isExplaining ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Gemma 4 is Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Explain Material
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* 2. EXPLANATION PANEL */}
            {explanation && (
              <section
                ref={explanationRef}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm transition-all space-y-4"
                aria-labelledby="explanation-heading"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h3
                        id="explanation-heading"
                        className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        Gemma 4 Explanation
                      </h3>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Language: {language} {simpleLanguage ? '• Simplified Mode' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Browser Text-to-Speech Player */}
                  <TextToSpeech text={explanation} language={language} label="Read Aloud" />
                </div>

                {/* Multimodal Source and Alt-Text Note */}
                {extractedMeta && extractedMeta.sourceType !== 'text' && (
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        Grounded in <strong>{extractedMeta.sourceType.toUpperCase()}</strong>: {extractedMeta.sourceName}
                      </span>
                    </span>
                    {extractedMeta.pageCount && (
                      <span className="font-mono text-[11px] bg-amber-200/60 dark:bg-amber-900 px-2 py-0.5 rounded-full">
                        {extractedMeta.pageCount} pages
                      </span>
                    )}
                  </div>
                )}

                {/* Adaptive Context Notice if weak concepts were sent */}
                {explanationWeakConcepts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 text-xs text-orange-900 dark:text-orange-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span>
                      <strong>Personalized for you:</strong> Gemma adapted this explanation to connect and clarify your previous weak concepts: {explanationWeakConcepts.join(', ')}.
                    </span>
                  </div>
                )}

                {/* Markdown Rendered Explanation Body */}
                <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans space-y-4">
                  <ReactMarkdown>{formatExplanationForDisplay(explanation)}</ReactMarkdown>
                </div>

                {/* Next step prompt */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ready to test your understanding of this material?
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Take Knowledge Check Quiz
                  </button>
                </div>
              </section>
            )}

            {/* 3. QUIZ PLAYER */}
            {quizQuestions && (
              <section ref={quizRef} aria-label="Knowledge check quiz section">
                <QuizPlayer
                  questions={quizQuestions}
                  onQuizComplete={handleQuizComplete}
                  onRequestRevision={handleRequestRevision}
                  isRevising={isRevising}
                />
              </section>
            )}

            {/* 4. ADAPTIVE REVISION SECTION */}
            {revisionContent && (
              <section ref={revisionRef} aria-label="Adaptive revision section">
                <RevisionSection
                  revisionContent={revisionContent}
                  targetedConcepts={revisionConcepts}
                  language={language}
                  onMarkMastered={handleMarkMastered}
                  onRetakeQuiz={handleGenerateQuiz}
                />
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400 mt-12 bg-white/50 dark:bg-zinc-950/50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StudyBud • Powered by Google Gemma 4 &amp; @google/genai SDK</span>
          <span>Accessibility-first • Device-local private learning history</span>
        </div>
      </footer>
    </div>
  );
}
