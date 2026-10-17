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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm transition-all space-y-6">
      {/* Header and Privacy/Storage Distinction Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Your Learning Progress & History
            </h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
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

      {/* Storage Distinction Notice */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block mb-0.5">Device Storage (Private to you)</span>
          Your learning history, quiz scores, and weak concepts are stored entirely in your local browser (localStorage). The Gemma 4 model is stateless and does not retain your private study history between sessions—StudyBud only sends relevant weak concepts to adapt explanations when you request them.
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Quizzes Completed</span>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{totalQuizzes}</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Average Quiz Score</span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {totalQuizzes > 0 ? `${averageScore}%` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Weak Concepts</span>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {weakConcepts.length}
          </div>
        </div>
      </div>

      {/* Weak Concepts List */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Weak Concepts Identified for Adaptive Revision
        </h4>

        {weakConcepts.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No weak concepts recorded yet. Take a quiz to let StudyBud discover topics you may need extra help with!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weakConcepts.map((item) => (
              <span
                key={item.concept}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs text-orange-900 dark:text-orange-200 font-medium"
              >
                <span>{item.concept}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-orange-200/60 dark:bg-orange-900 text-[10px] font-mono">
                  {item.count}× missed
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveWeakConcept(item.concept)}
                  className="p-0.5 rounded-full hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 transition-colors focus-visible:ring-1 focus-visible:ring-orange-500"
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
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2.5 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          Recent Quiz Results
        </h4>

        {quizHistory.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No quiz attempts recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {quizHistory.slice(0, 5).map((q) => (
              <div
                key={q.id}
                className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs gap-3"
              >
                <div className="truncate flex-1">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block truncate">
                    {q.materialTitle}
                  </span>
                  <span className="text-zinc-500 text-[11px]">
                    {new Date(q.timestamp).toLocaleDateString()} at{' '}
                    {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-bold px-2.5 py-0.5 rounded-full ${
                      q.percentage >= 80
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : q.percentage >= 60
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
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
