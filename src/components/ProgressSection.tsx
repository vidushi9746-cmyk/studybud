'use client';

import React from 'react';
import { History, Award, BookOpen, Trash2, ShieldCheck, CheckCircle2, TrendingUp, Sparkles, ExternalLink } from 'lucide-react';
import { QuizHistoryItem, StudySessionItem, WeakConceptEntry } from '@/types/study';

interface ProgressSectionProps {
  weakConcepts: WeakConceptEntry[];
  quizHistory: QuizHistoryItem[];
  studyHistory: StudySessionItem[];
  onRemoveWeakConcept: (concept: string) => void;
  onClearAllData: () => void;
  onSelectPastMaterial?: (content: string) => void;
}

export default function ProgressSection({
  weakConcepts,
  quizHistory,
  studyHistory,
  onRemoveWeakConcept,
  onClearAllData,
  onSelectPastMaterial,
}: ProgressSectionProps) {
  const totalQuizzes = quizHistory.length;
  const averageScore =
    totalQuizzes > 0
      ? Math.round(
          quizHistory.reduce((acc, curr) => acc + curr.percentage, 0) / totalQuizzes
        )
      : 0;

  return (
    <div className="bg-white dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xs transition-all space-y-6">
      {/* Header and Privacy/Storage Distinction Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Your Learning Progress & History
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Track quiz attempts, identify recurring weak concepts, and review past explanations.
          </p>
        </div>

        {/* Clear Data Button */}
        {(weakConcepts.length > 0 || quizHistory.length > 0 || studyHistory.length > 0) && (
          <button
            type="button"
            onClick={onClearAllData}
            className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 self-start sm:self-auto"
            title="Clear all stored local learning history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear local history
          </button>
        )}
      </div>

      {/* Storage Distinction Notice (Muted Sage Green) */}
      <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-200 shadow-2xs">
        <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block mb-0.5">Device Storage (Private to you)</span>
          Your learning history, quiz scores, and weak concepts are stored entirely in your local browser (localStorage). The Gemma 4 model is stateless and does not retain your private study history between sessions—StudyBud only sends relevant weak concepts to adapt explanations when you request them.
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Quizzes Completed</span>
          <div className="text-2xl font-bold text-[#1e1b24] dark:text-stone-100 mt-1">{totalQuizzes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Average Quiz Score</span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {totalQuizzes > 0 ? `${averageScore}%` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 shadow-2xs">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Active Weak Concepts</span>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {weakConcepts.length}
          </div>
        </div>
      </div>

      {/* Weak Concepts List */}
      <div>
        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Weak Concepts Identified for Adaptive Revision
        </h4>

        {weakConcepts.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500 dark:text-stone-400">
            No weak concepts recorded yet. Take a quiz to let StudyBud discover topics you may need extra help with!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weakConcepts.map((item) => (
              <span
                key={item.concept}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 font-medium shadow-2xs"
              >
                <span>{item.concept}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-200/70 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-[10px] font-mono">
                  {item.count}× missed
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveWeakConcept(item.concept)}
                  className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500"
                  aria-label={`Mark ${item.concept} as mastered and remove`}
                  title="Mark as mastered"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recent Quizzes */}
      <div>
        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2.5 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Recent Quiz Results
        </h4>

        {quizHistory.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500 dark:text-stone-400">
            No quiz attempts recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {quizHistory.slice(0, 5).map((q) => (
              <div
                key={q.id}
                className="p-3 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 flex items-center justify-between text-xs gap-3 shadow-2xs"
              >
                <div className="truncate flex-1">
                  <span className="font-semibold text-[#1e1b24] dark:text-stone-100 block truncate">
                    {q.materialTitle}
                  </span>
                  <span className="text-stone-500 text-[11px]">
                    {new Date(q.timestamp).toLocaleDateString()} at{' '}
                    {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      q.percentage >= 80
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : q.percentage >= 60
                        ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                        : 'bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    }`}
                  >
                    {q.score}/{q.total} ({q.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
