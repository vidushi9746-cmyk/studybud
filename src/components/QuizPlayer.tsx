'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Sparkles, RefreshCw, HelpCircle, ArrowRight } from 'lucide-react';
import { QuizQuestion, QuizSubmissionResult } from '@/types/study';

interface QuizPlayerProps {
  questions: QuizQuestion[];
  onQuizComplete: (result: QuizSubmissionResult) => void;
  onRequestRevision: (missedConcepts: string[], missedDetails: QuizSubmissionResult['missedQuestions']) => void;
  isRevising?: boolean;
}

export default function QuizPlayer({
  questions,
  onQuizComplete,
  onRequestRevision,
  isRevising = false,
}: QuizPlayerProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (isSubmitted) return; // Prevent changing after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.length === 0) return;

    let score = 0;
    const missedQuestions: QuizSubmissionResult['missedQuestions'] = [];
    const identifiedWeakConcepts: string[] = [];

    questions.forEach((q) => {
      const selected = selectedAnswers[q.id];
      const isCorrect = selected === q.correctAnswerIndex;

      if (isCorrect) {
        score += 1;
      } else {
        const selectedText = typeof selected === 'number' ? q.options[selected] || 'No option selected' : 'No option selected';
        const correctText = q.options[q.correctAnswerIndex] || '';

        missedQuestions.push({
          questionId: q.id,
          question: q.question,
          selectedOption: selectedText,
          correctOption: correctText,
          concept: q.concept,
          explanation: q.explanation,
        });

        if (q.concept && !identifiedWeakConcepts.includes(q.concept)) {
          identifiedWeakConcepts.push(q.concept);
        }
      }
    });

    const percentage = Math.round((score / questions.length) * 100);
    const subResult: QuizSubmissionResult = {
      score,
      total: questions.length,
      percentage,
      missedQuestions,
      identifiedWeakConcepts,
    };

    setResult(subResult);
    setIsSubmitted(true);
    onQuizComplete(subResult);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setResult(null);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const isAllAnswered = answeredCount === questions.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
              <HelpCircle className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Knowledge Check Quiz
            </h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            5 questions grounded directly in your study material. Answer all to identify concepts for adaptive revision.
          </p>
        </div>

        {/* Progress or Score badge */}
        {!isSubmitted ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 self-start sm:self-auto">
            <span>Progress: {answeredCount} / {questions.length}</span>
            <div className="w-16 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                result && result.percentage >= 80
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  : result && result.percentage >= 60
                  ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              Score: {result?.score} / {result?.total} ({result?.percentage}%)
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
              title="Retake Quiz"
              aria-label="Retake Quiz"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {questions.map((q, qIndex) => {
          const selected = selectedAnswers[q.id];
          const isCorrect = isSubmitted && selected === q.correctAnswerIndex;
          const isMissed = isSubmitted && selected !== q.correctAnswerIndex;

          return (
            <fieldset
              key={q.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
                !isSubmitted
                  ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50'
                  : isCorrect
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'
              }`}
            >
              {/* Question title & Concept tag */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-start gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Q{qIndex + 1}
                  </span>
                  <span>{q.question}</span>
                </legend>

                {q.concept && (
                  <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/70 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                    {q.concept}
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 mt-3" role="radiogroup" aria-label={`Options for Question ${qIndex + 1}`}>
                {q.options.map((opt, optIndex) => {
                  const isOptionSelected = selected === optIndex;
                  const isOptionCorrect = isSubmitted && optIndex === q.correctAnswerIndex;
                  const isOptionWrongSelected = isSubmitted && isOptionSelected && !isOptionCorrect;

                  let optionStyle = 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-300 dark:hover:border-amber-700';

                  if (isOptionSelected && !isSubmitted) {
                    optionStyle = 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/40';
                  } else if (isOptionCorrect) {
                    optionStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-400/40 font-medium';
                  } else if (isOptionWrongSelected) {
                    optionStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-950 dark:text-rose-100 ring-2 ring-rose-400/40';
                  }

                  return (
                    <label
                      key={optIndex}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer transition-all ${optionStyle} ${
                        isSubmitted ? 'cursor-default' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={optIndex}
                        checked={isOptionSelected}
                        disabled={isSubmitted}
                        onChange={() => handleSelectOption(q.id, optIndex)}
                        className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-zinc-300 dark:border-zinc-700"
                      />
                      <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                        {String.fromCharCode(65 + optIndex)}.
                      </span>
                      <span className="flex-1 text-zinc-800 dark:text-zinc-200">{opt}</span>

                      {/* Icon for feedback */}
                      {isOptionCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-label="Correct answer" />
                      )}
                      {isOptionWrongSelected && (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-label="Incorrect answer selected" />
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Explanation after submission */}
              {isSubmitted && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs leading-relaxed border ${
                    isCorrect
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                  }`}
                >
                  <span className="font-semibold block mb-0.5">
                    {isCorrect ? '✓ Well done!' : '💡 Why this matters:'}
                  </span>
                  {q.explanation}
                </div>
              )}
            </fieldset>
          );
        })}

        {/* Submit or Adaptive Revision Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          {!isSubmitted ? (
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {!isAllAnswered ? `Answer all 5 questions to submit (${answeredCount}/5 complete)` : 'All questions answered!'}
              </span>
              <button
                type="submit"
                disabled={!isAllAnswered}
                className={`px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center gap-2 ${
                  isAllAnswered
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 active:scale-95'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                Submit Answers
              </button>
            </div>
          ) : (
            <div className="w-full bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {result && result.identifiedWeakConcepts.length > 0
                    ? `Adaptive Revision Ready (${result.identifiedWeakConcepts.length} concept${result.identifiedWeakConcepts.length > 1 ? 's' : ''} to review)`
                    : 'Perfect Score! All concepts mastered.'}
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
                  {result && result.identifiedWeakConcepts.length > 0
                    ? `Gemma 4 will create a personalized revision lesson addressing: ${result.identifiedWeakConcepts.join(', ')}.`
                    : 'You aced this quiz! You can still request a revision or test another topic.'}
                </p>
              </div>

              {result && result.identifiedWeakConcepts.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onRequestRevision(result.identifiedWeakConcepts, result.missedQuestions)
                  }
                  disabled={isRevising}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isRevising ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Crafting Revision...
                    </>
                  ) : (
                    <>
                      Revise Missed Concepts
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
