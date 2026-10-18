'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Sparkles } from 'lucide-react';
import { SupportedLanguage } from '@/types/study';

interface VoiceQuestionInputProps {
  value: string;
  onChange: (val: string) => void;
  language?: SupportedLanguage;
  placeholder?: string;
  id?: string;
}

const LANGUAGE_SPEECH_MAP: Record<SupportedLanguage, string> = {
  English: 'en-US',
  Hindi: 'hi-IN',
  Kannada: 'kn-IN',
  Hinglish: 'en-IN',
};

export default function VoiceQuestionInput({
  value,
  onChange,
  language = 'English',
  placeholder = 'e.g. What is the difference between light reactions and the Calvin cycle?',
  id = 'study-question-input',
}: VoiceQuestionInputProps) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
      }
    }
  }, []);

  const startListening = () => {
    if (!isSupported) return;
    setSpeechError(null);

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LANGUAGE_SPEECH_MAP[language] || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening... Speak your question clearly into your microphone.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          onChange(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setSpeechError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setStatusMessage('No speech was detected. Click the microphone to try again.');
        } else {
          setSpeechError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setStatusMessage('Voice recognition complete. You can review or edit the question above.');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setSpeechError(err.message || 'Unable to start speech recognition.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <span>Specific Question or Focus Area (Optional)</span>
        </label>

        {isSupported && (
          <span className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:inline">
            Voice input supported ({language})
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl pl-3.5 pr-12 py-2.5 text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700/80 text-[#1e1b24] dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans shadow-xs"
        />

        {/* Microphone Button */}
        {isSupported ? (
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-2 p-1.5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus:outline-none cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                : 'text-stone-500 hover:text-indigo-600 dark:text-stone-400 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            aria-label={isListening ? 'Stop listening' : `Ask question using voice in ${language}`}
            aria-pressed={isListening}
            title={isListening ? 'Stop listening' : `Dictate question via voice (${language})`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Mic className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      {/* Screen Reader and Visual Voice Status Announcement */}
      <div aria-live="polite" className="text-xs">
        {isListening && (
          <p className="text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1.5 pt-0.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            {statusMessage}
          </p>
        )}
        {!isListening && statusMessage && (
          <p className="text-stone-500 dark:text-stone-400 text-[11px] pt-0.5">{statusMessage}</p>
        )}
        {speechError && (
          <p className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 pt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {speechError}
          </p>
        )}
      </div>
    </div>
  );
}
