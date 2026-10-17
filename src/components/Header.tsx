'use client';

import React from 'react';
import { Sparkles, Brain, CheckCircle2, AlertTriangle, Eye, Type, Contrast } from 'lucide-react';
import { UserPreferences } from '@/lib/storage';

interface HeaderProps {
  modelName: string;
  isModelReady: boolean;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
}

export default function Header({
  modelName,
  isModelReady,
  preferences,
  onUpdatePreferences,
}: HeaderProps) {
  return (
    <header className="border-b border-amber-200/70 dark:border-zinc-800 bg-amber-50/50 dark:bg-zinc-950/70 backdrop-blur sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Brand & Purpose */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-bold text-xl select-none">
            🌱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                StudyBud
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60">
                  Gemma 4
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Accessibility-first adaptive learning companion
            </p>
          </div>
        </div>

        {/* Status & Accessibility Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
          {/* Model Connectivity Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isModelReady
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
            }`}
            title={`Configured Gemma Model: ${modelName}`}
          >
            {isModelReady ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[11px] truncate max-w-[140px] sm:max-w-none">
                  {modelName}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Checking API...</span>
              </>
            )}
          </div>

          {/* Accessibility Controls Toolbar */}
          <div
            className="flex items-center gap-1 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-full p-1 shadow-sm"
            role="toolbar"
            aria-label="Display and accessibility settings"
          >
            {/* Font Size Adjuster */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  onUpdatePreferences({
                    fontSize:
                      preferences.fontSize === 'normal'
                        ? 'large'
                        : preferences.fontSize === 'large'
                        ? 'xlarge'
                        : 'normal',
                  })
                }
                className="px-2 py-1 rounded-full text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 text-zinc-700 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-amber-500"
                aria-label={`Change text size. Current: ${preferences.fontSize}`}
                title="Adjust Text Size (Standard / Large / Extra Large)"
              >
                <Type className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] uppercase tracking-wider font-mono">
                  {preferences.fontSize === 'normal' ? '1x' : preferences.fontSize === 'large' ? '1.2x' : '1.4x'}
                </span>
              </button>
            </div>

            {/* High Contrast Toggle */}
            <button
              type="button"
              onClick={() => onUpdatePreferences({ highContrast: !preferences.highContrast })}
              className={`p-1.5 rounded-full text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 ${
                preferences.highContrast
                  ? 'bg-zinc-900 text-yellow-300 dark:bg-zinc-100 dark:text-zinc-900 shadow-inner'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              aria-label={preferences.highContrast ? 'Disable high contrast' : 'Enable high contrast'}
              title="High Contrast Mode"
            >
              <Contrast className="w-3.5 h-3.5" />
            </button>

            {/* Dyslexia / High Legibility Font Toggle */}
            <button
              type="button"
              onClick={() => onUpdatePreferences({ dyslexicFont: !preferences.dyslexicFont })}
              className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 ${
                preferences.dyslexicFont
                  ? 'bg-amber-500 text-white dark:bg-amber-600'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              aria-label={
                preferences.dyslexicFont
                  ? 'Disable high legibility font'
                  : 'Enable high legibility reading spacing'
              }
              title="Toggle High-Legibility Reading Font"
            >
              Readable
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
