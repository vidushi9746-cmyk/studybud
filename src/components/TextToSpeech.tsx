'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { SupportedLanguage } from '@/types/study';
import { cleanTextForSpeech } from '@/lib/speechCleaner';

interface TextToSpeechProps {
  text: string;
  language?: SupportedLanguage;
  label?: string;
}

const LANGUAGE_LOCALES: Record<SupportedLanguage, string[]> = {
  English: ['en-US', 'en-IN', 'en-GB', 'en'],
  Hindi: ['hi-IN', 'hi'],
  Kannada: ['kn-IN', 'kn'],
  Hinglish: ['en-IN', 'hi-IN', 'en'],
};

export default function TextToSpeech({ text, language = 'English', label = 'Read explanation aloud' }: TextToSpeechProps) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speech if text changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [text]);

  const selectVoiceForLanguage = (): SpeechSynthesisVoice | null => {
    if (availableVoices.length === 0) return null;
    const targetLocales = LANGUAGE_LOCALES[language] || ['en-US'];

    for (const locale of targetLocales) {
      const match = availableVoices.find(
        (v) => v.lang.toLowerCase() === locale.toLowerCase() || v.lang.toLowerCase().startsWith(locale.toLowerCase())
      );
      if (match) return match;
    }
    return availableVoices[0] || null;
  };

  const handlePlay = () => {
    if (!isSupported || !text) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanContent = cleanTextForSpeech(text);
    if (!cleanContent) return;

    const utterance = new SpeechSynthesisUtterance(cleanContent);
    utterance.rate = rate;
    const voice = selectVoiceForLanguage();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const toggleRate = () => {
    const rates = [0.8, 1.0, 1.25];
    const nextIdx = (rates.indexOf(rate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setRate(newRate);
    if (isPlaying) {
      handleStop();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div
      className="inline-flex items-center gap-2 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-full px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 shadow-sm"
      role="region"
      aria-label="Speech synthesizer controls"
    >
      <span className="flex items-center gap-1.5">
        <Volume2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </span>

      <div className="flex items-center gap-1 ml-1 border-l border-amber-300 dark:border-amber-800 pl-2">
        {!isPlaying ? (
          <button
            type="button"
            onClick={handlePlay}
            className="p-1 rounded-full hover:bg-amber-200/70 dark:hover:bg-amber-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-none"
            aria-label={isPaused ? 'Resume speaking' : 'Play reading aloud'}
            title={isPaused ? 'Resume reading' : 'Read aloud'}
          >
            <Play className="w-3.5 h-3.5 text-amber-900 dark:text-amber-100 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="p-1 rounded-full hover:bg-amber-200/70 dark:hover:bg-amber-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-none"
            aria-label="Pause speaking"
            title="Pause"
          >
            <Pause className="w-3.5 h-3.5 text-amber-900 dark:text-amber-100 fill-current" />
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="p-1 rounded-full hover:bg-amber-200/70 dark:hover:bg-amber-800/80 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-none"
            aria-label="Stop speaking"
            title="Stop reading"
          >
            <VolumeX className="w-3.5 h-3.5 text-amber-900 dark:text-amber-100" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleRate}
          className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-amber-100/90 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-none"
          aria-label={`Change reading speed, current ${rate}x`}
          title="Toggle speed (0.8x, 1x, 1.25x)"
        >
          {rate}x
        </button>

        {isPlaying && (
          <span className="flex items-center gap-0.5 px-1" aria-hidden="true">
            <span className="w-1 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="w-1 h-3.5 bg-amber-600 rounded-full animate-pulse delay-75" />
            <span className="w-1 h-2 bg-amber-500 rounded-full animate-pulse delay-150" />
          </span>
        )}
      </div>
    </div>
  );
}
