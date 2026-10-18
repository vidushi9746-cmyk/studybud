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
    <div className="bg-white dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xs transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
              <HelpCircle className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Knowledge Check Quiz
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            5 questions grounded directly in your study material. Answer all to identify concepts for adaptive revision.
          </p>
        </div>

        {/* Progress or Score badge */}
        {!isSubmitted ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Q1–Q5 Stepper */}
            <div className="flex items-center gap-1.5" aria-label="Question status stepper">
              {questions.map((q, idx) => {
                const isAnswered = typeof selectedAnswers[q.id] === 'number';
                return (
                  <span
                    key={q.id}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
                      isAnswered
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
                    }`}
                  >
                    Q{idx + 1}
                  </span>
                );
              })}
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-[#1e1b24] dark:text-stone-300">
              <span>{answeredCount}/{questions.length}</span>
              <div className="w-14 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Q1–Q5 Stepper with outcome */}
            <div className="flex items-center gap-1.5" aria-label="Question results stepper">
              {questions.map((q, idx) => {
                const isCorrect = selectedAnswers[q.id] === q.correctAnswerIndex;
                return (
                  <span
                    key={q.id}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                      isCorrect
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-rose-500 text-white border-rose-500 shadow-xs'
                    }`}
                    title={`Question ${idx + 1}: ${isCorrect ? 'Correct' : 'Needs Review'}`}
                  >
                    Q{idx + 1} {isCorrect ? '✓' : '×'}
                  </span>
                );
              })}
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                result && result.percentage >= 80
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  : result && result.percentage >= 60
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                  : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              Score: {result?.score} / {result?.total} ({result?.percentage}%)
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
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
              id={`question-item-${q.id}`}
              className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
                !isSubmitted
                  ? 'border-stone-200/80 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40'
                  : isCorrect
                  ? 'border-emerald-300/80 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-rose-300/80 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
              }`}
            >
              {/* Question title & Concept tag */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                <legend className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-start gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    Q{qIndex + 1}
                  </span>
                  <span>{q.question}</span>
                </legend>

                {q.concept && (
                  <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shrink-0 shadow-2xs">
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

                  let optionStyle = 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-[#1e1b24] dark:text-stone-100';

                  if (isOptionSelected && !isSubmitted) {
                    optionStyle = 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-400/30';
                  } else if (isOptionCorrect) {
                    optionStyle = 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-400/30 font-medium';
                  } else if (isOptionWrongSelected) {
                    optionStyle = 'border-rose-400 bg-rose-50/80 dark:bg-rose-950/60 text-rose-950 dark:text-rose-100 ring-2 ring-rose-400/30';
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
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-stone-300 dark:border-stone-700"
                      />
                      <span className="font-mono text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">
                        {String.fromCharCode(65 + optIndex)}.
                      </span>
                      <span className="flex-1 text-[#1e1b24] dark:text-stone-100">{opt}</span>

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
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                      : 'bg-stone-100 dark:bg-stone-800 border-stone-200/80 dark:border-stone-700 text-[#1e1b24] dark:text-stone-200'
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
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {!isAllAnswered ? `Answer all 5 questions to submit (${answeredCount}/5 complete)` : 'All questions answered!'}
              </span>
              <button
                type="submit"
                disabled={!isAllAnswered}
                className={`px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center gap-2 ${
                  isAllAnswered
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-95'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                }`}
              >
                Submit Answers
              </button>
            </div>
          ) : (
            <div className="w-full bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-emerald-50/50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-emerald-950/30 border border-indigo-200/80 dark:border-indigo-800/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {result && result.identifiedWeakConcepts.length > 0
                    ? `Adaptive Revision Ready (${result.identifiedWeakConcepts.length} concept${result.identifiedWeakConcepts.length > 1 ? 's' : ''} to review)`
                    : 'Perfect Score! All concepts mastered.'}
                </h4>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-200/80 mt-0.5">
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 disabled:opacity-50"
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
