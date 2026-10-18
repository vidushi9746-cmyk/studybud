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
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f2] dark:bg-[#151319]">
        <div className="flex items-center gap-3 text-stone-800 dark:text-stone-200 font-medium">
          <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
        {/* Welcoming Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 mb-2.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Adaptive Study Companion • Powered by Google Gemma 4</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Master Any Subject, Step by Step
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 max-w-xl">
              Turn lecture slides, textbook notes, diagrams, videos, and audio into grounded explanations, interactive quizzes, and adaptive revision.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 dark:border-stone-800 pb-3">
          <nav className="flex items-center gap-2" aria-label="StudyBud main navigation">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Study Workspace
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('progress')}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'progress'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <History className="w-4 h-4" />
              Learning Progress & History
              {weakConcepts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {weakConcepts.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Global Error Banner */}
        {apiError && (
          <div
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-3 shadow-xs"
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
              className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
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
            {/* PROMINENT SAMPLE LESSONS STARTER DECK */}
            <section aria-labelledby="sample-lessons-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    id="sample-lessons-heading"
                    className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Quick Start with Sample Lessons
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Explore StudyBud immediately using curated curriculum lessons.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_LESSONS.map((sample) => (
                  <div
                    key={sample.id}
                    className="group relative flex flex-col justify-between p-5 rounded-3xl bg-white/90 dark:bg-stone-900/90 border border-stone-200/90 dark:border-stone-800 hover:border-indigo-400 dark:hover:border-indigo-600/60 shadow-xs hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-2xs">
                          <span>{sample.emoji}</span>
                          <span>{sample.subject}</span>
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono">Sample Deck</span>
                      </div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {sample.title}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                        {sample.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-[210px] sm:max-w-xs">
                        Focus: {sample.suggestedQuestion}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLoadSample(sample.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                      >
                        <span>Study Lesson</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* RESPONSIVE 8+4 WORKSPACE DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT / MAIN WORKSPACE COLUMN (8 COLS) */}
              <div className="lg:col-span-8 space-y-6">
                {/* 1. INPUT WORKSPACE CARD */}
                <section
                  className="bg-white dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xs transition-all space-y-5"
                  aria-labelledby="workspace-heading"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2
                        id="workspace-heading"
                        className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"
                      >
                        <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Study Material Station
                      </h2>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Select a source format below to import or write your study notes.
                      </p>
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
                  <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800">
                    <VoiceQuestionInput
                      value={question}
                      onChange={setQuestion}
                      language={language}
                      id="study-question-input"
                      placeholder="e.g. What is the difference between light reactions and the Calvin cycle?"
                    />
                  </div>

                  {/* Study Preferences & Action Command Center */}
                  <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Language Selector */}
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                        <label htmlFor="language-select" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
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
                          className="text-xs font-semibold rounded-xl px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[#1e1b24] dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                        >
                          <option value="English" className="bg-white dark:bg-stone-900 text-[#1e1b24] dark:text-stone-100">English</option>
                          <option value="Hindi" className="bg-white dark:bg-stone-900 text-[#1e1b24] dark:text-stone-100">हिन्दी (Hindi)</option>
                          <option value="Kannada" className="bg-white dark:bg-stone-900 text-[#1e1b24] dark:text-stone-100">ಕನ್ನಡ (Kannada)</option>
                          <option value="Hinglish" className="bg-white dark:bg-stone-900 text-[#1e1b24] dark:text-stone-100">Hinglish (Hindi-English blend)</option>
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
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-stone-300 dark:border-stone-700"
                        />
                        <span className="text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
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
                        className="px-4 py-2.5 rounded-2xl border border-stone-300/90 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                      >
                        {isGeneratingQuiz ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                            Generating Quiz...
                          </>
                        ) : (
                          <>
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Generate Quiz
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleExplain}
                        disabled={isExplaining || isGeneratingQuiz || !material.trim()}
                        className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
              </div>

              {/* RIGHT / SIDEBAR COMPANION COLUMN (4 COLS) */}
              <aside className="lg:col-span-4 space-y-5" aria-label="Study Session Companion">
                {/* 1. ACTUAL SESSION WORKFLOW STEPPER */}
                <div className="p-5 rounded-3xl bg-white/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      Study Session Stepper
                    </h3>
                    <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                      Live State
                    </span>
                  </div>

                  <ol className="space-y-3.5 text-xs">
                    {/* Step 1: Material Ingestion */}
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          material.trim().length > 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {material.trim().length > 0 ? '✓' : '1'}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                          1. Ingest Material
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                          {material.trim().length > 0
                            ? `${material.length} characters loaded`
                            : 'Awaiting notes, PDF, image, or video'}
                        </span>
                      </div>
                    </li>

                    {/* Step 2: Conceptual Explanation */}
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          explanation
                            ? 'bg-emerald-600 text-white'
                            : isExplaining
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {explanation ? '✓' : '2'}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                          2. Conceptual Explanation
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                          {explanation
                            ? 'Explanation generated'
                            : isExplaining
                            ? 'Gemma is synthesizing...'
                            : 'Ready to generate'}
                        </span>
                      </div>
                    </li>

                    {/* Step 3: Knowledge Check Quiz */}
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          quizQuestions
                            ? 'bg-emerald-600 text-white'
                            : isGeneratingQuiz
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {quizQuestions ? '✓' : '3'}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                          3. Knowledge Check
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                          {quizQuestions
                            ? `${quizQuestions.length} questions active`
                            : isGeneratingQuiz
                            ? 'Creating questions...'
                            : '5 grounded questions'}
                        </span>
                      </div>
                    </li>

                    {/* Step 4: Adaptive Revision */}
                    <li className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          revisionContent
                            ? 'bg-emerald-600 text-white'
                            : isRevising
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {revisionContent ? '✓' : '4'}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                          4. Adaptive Revision
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                          {revisionContent
                            ? 'Revision lesson active'
                            : isRevising
                            ? 'Personalizing lesson...'
                            : weakConcepts.length > 0
                            ? `${weakConcepts.length} weak concept${weakConcepts.length > 1 ? 's' : ''} saved`
                            : 'Unlocks if concepts missed'}
                        </span>
                      </div>
                    </li>
                  </ol>
                </div>

                {/* 2. REAL LEARNING PULSE (STRICTLY FROM ACTUAL DATA) */}
                <div className="p-5 rounded-3xl bg-white/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      Learning Pulse
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('progress')}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  {quizHistory.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 text-center text-xs text-stone-600 dark:text-stone-300 space-y-2 shadow-2xs">
                      <p>Your learning progress will appear here after your first quiz.</p>
                      <button
                        type="button"
                        onClick={handleGenerateQuiz}
                        disabled={!material.trim() || isGeneratingQuiz}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        Take a quiz to start tracking
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
                          <span className="text-[10px] text-stone-600 dark:text-stone-400 block font-semibold">Quizzes</span>
                          <span className="text-base font-bold text-[#1e1b24] dark:text-stone-100">{quizHistory.length}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
                          <span className="text-[10px] text-stone-600 dark:text-stone-400 block font-semibold">Avg Score</span>
                          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                            {Math.round(quizHistory.reduce((acc, curr) => acc + curr.percentage, 0) / quizHistory.length)}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
                          <span className="text-[10px] text-stone-600 dark:text-stone-400 block font-semibold">Weak</span>
                          <span className="text-base font-bold text-amber-700 dark:text-amber-400">{weakConcepts.length}</span>
                        </div>
                      </div>

                      {weakConcepts.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                          <span>{weakConcepts.length} concept{weakConcepts.length > 1 ? 's' : ''} flagged for review</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('progress')}
                            className="font-semibold underline ml-1 cursor-pointer"
                          >
                            Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. ACCESSIBILITY & AUDIO TIP */}
                <div className="p-4 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5 shadow-2xs">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Clean Audio Read-Aloud</span>
                  </div>
                  <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
                    StudyBud automatically strips emojis and markdown symbols before speech synthesis, so explanations sound natural and distraction-free.
                  </p>
                </div>
              </aside>
            </div>

            {/* SEPARATED LEARNING OUTPUTS SECTION */}
            <div className="space-y-8 pt-4">
              {/* 2. EXPLANATION PANEL */}
              {explanation && (
                <section
                  ref={explanationRef}
                  className="bg-white dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xs transition-all space-y-4"
                  aria-labelledby="explanation-heading"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200/80 dark:border-stone-800">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/25">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h3
                          id="explanation-heading"
                          className="text-lg font-bold text-stone-900 dark:text-stone-100"
                        >
                          Gemma 4 Explanation
                        </h3>
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          Language: {language} {simpleLanguage ? '• Simplified Mode' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Browser Text-to-Speech Player */}
                    <TextToSpeech text={explanation} language={language} label="Read Aloud" />
                  </div>

                  {/* Multimodal Source and Alt-Text Note */}
                  {extractedMeta && extractedMeta.sourceType !== 'text' && (
                    <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-2xs">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>
                          Grounded in <strong>{extractedMeta.sourceType.toUpperCase()}</strong>: {extractedMeta.sourceName}
                        </span>
                      </span>
                      {extractedMeta.pageCount && (
                        <span className="font-mono text-[11px] bg-emerald-200/70 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                          {extractedMeta.pageCount} pages
                        </span>
                      )}
                    </div>
                  )}

                  {/* Adaptive Context Notice if weak concepts were sent */}
                  {explanationWeakConcepts.length > 0 && (
                    <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2 shadow-2xs">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>
                        <strong>Personalized for you:</strong> Gemma adapted this explanation to connect and clarify your previous weak concepts: {explanationWeakConcepts.join(', ')}.
                      </span>
                    </div>
                  )}

                  {/* Markdown Rendered Explanation Body */}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-stone-800 dark:text-stone-200 leading-relaxed font-sans space-y-4">
                    <ReactMarkdown>{formatExplanationForDisplay(explanation)}</ReactMarkdown>
                  </div>

                  {/* Next step prompt */}
                  <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      Ready to test your understanding of this material?
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateQuiz}
                      disabled={isGeneratingQuiz}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 dark:border-stone-800/80 py-6 text-center text-xs text-stone-500 dark:text-stone-400 mt-12 bg-white/40 dark:bg-stone-950/40">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StudyBud • Powered by Google Gemma 4 &amp; @google/genai SDK</span>
          <span>Accessibility-first • Device-local private learning history</span>
        </div>
      </footer>
    </div>
  );
}
