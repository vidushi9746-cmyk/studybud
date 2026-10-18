'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Check, CheckCheck, RefreshCw, BookOpen, AlertCircle } from 'lucide-react';
import TextToSpeech from './TextToSpeech';
import { SupportedLanguage } from '@/types/study';
import { formatExplanationForDisplay } from '@/lib/explanationFormatter';

interface RevisionSectionProps {
  revisionContent: string;
  targetedConcepts: string[];
  language?: SupportedLanguage;
  onMarkMastered?: (concepts: string[]) => void;
  onRetakeQuiz?: () => void;
}

export default function RevisionSection({
  revisionContent,
  targetedConcepts,
  language = 'English',
  onMarkMastered,
  onRetakeQuiz,
}: RevisionSectionProps) {
  const [hasMarkedMastered, setHasMarkedMastered] = useState<boolean>(false);

  const handleMarkMastered = () => {
    setHasMarkedMastered(true);
    if (onMarkMastered) {
      onMarkMastered(targetedConcepts);
    }
  };

  return (
    <div className="bg-gradient-to-b from-white via-indigo-50/20 to-emerald-50/20 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 border border-indigo-200/70 dark:border-indigo-800/60 rounded-3xl p-5 sm:p-7 shadow-xs transition-all space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/25">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Adaptive Revision Masterclass
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Gemma 4 tailored this revision using a different angle, memory hooks, and analogies to clear your specific misconceptions.
          </p>
        </div>

        {/* TTS Player */}
        <div className="self-start sm:self-auto">
          <TextToSpeech text={revisionContent} language={language} label="Listen to revision" />
        </div>
      </div>

      {/* Targeted Concepts Badge Bar */}
      {targetedConcepts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 shadow-2xs">
          <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Remediating:
          </span>
          {targetedConcepts.map((c, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Revision Body */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-stone-800 dark:text-stone-200 leading-relaxed font-sans space-y-4">
        <ReactMarkdown>{formatExplanationForDisplay(revisionContent)}</ReactMarkdown>
      </div>

      {/* Post-Revision Action Toolbar */}
      <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Feel confident with these concepts now?
        </span>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onRetakeQuiz && (
            <button
              type="button"
              onClick={onRetakeQuiz}
              className="px-3.5 py-2 rounded-xl border border-stone-300/80 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retake Quiz
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkMastered}
            disabled={hasMarkedMastered}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all ${
              hasMarkedMastered
                ? 'bg-emerald-700 text-white cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
            }`}
          >
            {hasMarkedMastered ? (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                Marked as Mastered!
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                I Understand Now (Clear Weak Concept)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
