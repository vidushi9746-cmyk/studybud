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
    <div className="bg-gradient-to-b from-amber-50/70 to-orange-50/30 dark:from-zinc-900 dark:to-zinc-950 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-5 sm:p-7 shadow-sm transition-all space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/80 dark:border-amber-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Adaptive Revision Masterclass
            </h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
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
        <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-100/60 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Remediating:
          </span>
          {targetedConcepts.map((c, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-700 shadow-2xs"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Revision Body */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans space-y-4">
        <ReactMarkdown>{formatExplanationForDisplay(revisionContent)}</ReactMarkdown>
      </div>

      {/* Post-Revision Action Toolbar */}
      <div className="pt-4 border-t border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Feel confident with these concepts now?
        </span>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onRetakeQuiz && (
            <button
              type="button"
              onClick={onRetakeQuiz}
              className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retake Quiz
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkMastered}
            disabled={hasMarkedMastered}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all ${
              hasMarkedMastered
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
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
