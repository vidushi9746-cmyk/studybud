'use client';

import React, { useState, useRef } from 'react';
import {
  FileText,
  FileUp,
  Image as ImageIcon,
  Video,
  Mic,
  Upload,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Info,
  X,
  Globe,
} from 'lucide-react';
import { MaterialSourceType, ExtractedMaterial, SupportedLanguage } from '@/types/study';
import { SAMPLE_LESSONS } from '@/lib/sampleLessons';

interface UnifiedMaterialInputProps {
  material: string;
  onMaterialChange: (val: string) => void;
  extractedMeta: ExtractedMaterial | null;
  onExtractedMetaChange: (meta: ExtractedMaterial | null) => void;
  onLoadSample: (sampleId: string) => void;
  language?: SupportedLanguage;
  simpleLanguage?: boolean;
}

export default function UnifiedMaterialInput({
  material,
  onMaterialChange,
  extractedMeta,
  onExtractedMetaChange,
  onLoadSample,
  language = 'English',
  simpleLanguage = false,
}: UnifiedMaterialInputProps) {
  const [activeTab, setActiveTab] = useState<MaterialSourceType>('text');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Video state
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoTranscriptInput, setVideoTranscriptInput] = useState<string>('');

  // File input refs
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // strip data:...;base64, prefix
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 1. Handle PDF Upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadError('Invalid file format. Please upload a standard PDF document.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError(`PDF file size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed size is 20MB.`);
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus(`Extracting text from ${file.name}...`);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pdf',
          fileBase64: base64,
          fileName: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to extract text from PDF.');
      }

      onMaterialChange(data.text);
      onExtractedMetaChange({
        sourceType: 'pdf',
        sourceName: file.name,
        text: data.text,
        pageCount: data.pageCount,
        isScannedPdf: data.isScannedPdf,
        warning: data.warning,
      });
      setProcessingStatus('');
    } catch (err: any) {
      setUploadError(err.message || 'Error parsing PDF document.');
    } finally {
      setIsProcessing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // 2. Handle Image Upload (Diagrams / Notes OCR)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setUploadError('Invalid image format. Supported formats: PNG, JPEG, WebP, GIF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`Image size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed is 10MB.`);
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus(`Analyzing image with Gemma 4 vision (${file.name})...`);

    // Create client thumbnail preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          fileBase64: base64,
          mimeType: file.type,
          fileName: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to analyze diagram image.');
      }

      onMaterialChange(data.text);
      onExtractedMetaChange({
        sourceType: 'image',
        sourceName: file.name,
        text: data.text,
        description: data.description,
      });
      setProcessingStatus('');
    } catch (err: any) {
      setUploadError(err.message || 'Error analyzing image.');
    } finally {
      setIsProcessing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // 3. Handle Video Explanation via Gemini 3.5 Flash
  const handleExplainVideo = async () => {
    if (!videoUrl.trim()) {
      setUploadError('Please enter a public YouTube video URL (e.g. https://www.youtube.com/watch?v=...).');
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus(`Analyzing YouTube video with Gemini 3.5 Flash (${language}${simpleLanguage ? ' • Simplified' : ''})...`);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video_url',
          videoUrl: videoUrl.trim(),
          language,
          simpleLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || data.warning || 'Failed to analyze YouTube video.');
      }

      onMaterialChange(data.text);
      onExtractedMetaChange({
        sourceType: 'video',
        sourceName: data.sourceName,
        text: data.text,
        warning: data.warning,
      });
      setProcessingStatus('');
    } catch (err: any) {
      setUploadError(err.message || 'Error analyzing YouTube video.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Accessible Fallback: Load pasted transcript
  const handleLoadTranscript = async () => {
    if (!videoTranscriptInput.trim()) {
      setUploadError('Please paste your video transcript or subtitle text first.');
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus('Loading transcript into workspace...');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video_url',
          videoUrl: videoUrl.trim() || undefined,
          transcriptText: videoTranscriptInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to load transcript.');
      }

      onMaterialChange(data.text);
      onExtractedMetaChange({
        sourceType: 'video',
        sourceName: data.sourceName || videoUrl.trim() || 'Pasted Video Transcript',
        text: data.text,
      });
      setProcessingStatus('');
    } catch (err: any) {
      setUploadError(err.message || 'Error loading transcript.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Handle Audio Media Upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`Audio file size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed is 15MB.`);
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus(`Processing audio file (${file.name})...`);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'audio',
          fileBase64: base64,
          mimeType: file.type || 'audio/mpeg',
          fileName: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Audio transcription unavailable.');
      }

      onMaterialChange(data.text);
      onExtractedMetaChange({
        sourceType: 'audio',
        sourceName: file.name,
        text: data.text,
      });
      setProcessingStatus('');
    } catch (err: any) {
      setUploadError(err.message || 'Error transcribing audio file.');
    } finally {
      setIsProcessing(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onMaterialChange('');
    onExtractedMetaChange(null);
    setImagePreviewUrl(null);
    setUploadError(null);
    setVideoUrl('');
    setVideoTranscriptInput('');
  };

  return (
    <div className="space-y-4">
      {/* Multimodal Source Selectors with Capability Descriptions */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
        role="tablist"
        aria-label="Study material input source options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-start p-3 rounded-2xl text-left border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'text'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-stone-700 hover:bg-stone-50/60 dark:hover:bg-stone-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className={`p-1.5 rounded-xl ${activeTab === 'text' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
              <FileText className="w-4 h-4" aria-hidden="true" />
            </span>
            {activeTab === 'text' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">Pasted Text</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
            Type or paste notes
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pdf'}
          onClick={() => setActiveTab('pdf')}
          className={`flex flex-col items-start p-3 rounded-2xl text-left border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'pdf'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-stone-700 hover:bg-stone-50/60 dark:hover:bg-stone-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className={`p-1.5 rounded-xl ${activeTab === 'pdf' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
              <FileUp className="w-4 h-4" aria-hidden="true" />
            </span>
            {activeTab === 'pdf' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">PDF Document</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
            Slides &amp; book chapters
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          onClick={() => setActiveTab('image')}
          className={`flex flex-col items-start p-3 rounded-2xl text-left border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'image'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-stone-700 hover:bg-stone-50/60 dark:hover:bg-stone-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className={`p-1.5 rounded-xl ${activeTab === 'image' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
            </span>
            {activeTab === 'image' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">Image / Diagram</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
            Visual label extraction
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'video'}
          onClick={() => setActiveTab('video')}
          className={`flex flex-col items-start p-3 rounded-2xl text-left border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'video'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-stone-700 hover:bg-stone-50/60 dark:hover:bg-stone-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className={`p-1.5 rounded-xl ${activeTab === 'video' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
              <Video className="w-4 h-4" aria-hidden="true" />
            </span>
            {activeTab === 'video' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">Video Lecture</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
            YouTube direct video
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audio'}
          onClick={() => setActiveTab('audio')}
          className={`flex flex-col items-start p-3 rounded-2xl text-left border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 col-span-2 sm:col-span-1 ${
            activeTab === 'audio'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/20'
              : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-indigo-300 dark:hover:border-stone-700 hover:bg-stone-50/60 dark:hover:bg-stone-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className={`p-1.5 rounded-xl ${activeTab === 'audio' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
              <Mic className="w-4 h-4" aria-hidden="true" />
            </span>
            {activeTab === 'audio' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-xs font-bold leading-tight">Audio File</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
            Lecture speech to text
          </span>
        </button>
      </div>

      {/* Screen Reader and Visual Processing Status */}
      {/* Screen Reader and Visual Processing Status */}
      <div aria-live="polite" className="text-xs">
        {isProcessing && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 flex items-center gap-2.5 shadow-xs">
            <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-medium">{processingStatus}</span>
          </div>
        )}
        {uploadError && (
          <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200 flex items-start gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Extraction Notice</span>
              {uploadError}
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-xs font-medium hover:underline text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 0. PASTED TEXT GUIDANCE BAY */}
      {activeTab === 'text' && (
        <div className="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-stone-900/40 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
              <FileText className="w-3.5 h-3.5" />
            </span>
            <span>
              Type or paste your lecture notes, textbook chapters, or summary outline directly into the study workspace below.
            </span>
          </div>
          <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
            Direct Editor
          </span>
        </div>
      )}

      {/* 1. PDF UPLOAD TAB */}
      {activeTab === 'pdf' && (
        <div className="p-6 rounded-3xl border-2 border-dashed border-indigo-200/80 hover:border-indigo-400 dark:border-stone-700/80 bg-indigo-50/20 dark:bg-stone-900/40 text-center space-y-3 transition-colors">
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handlePdfUpload}
            className="hidden"
            id="pdf-file-upload"
          />
          <div className="mx-auto w-11 h-11 rounded-2xl bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shadow-xs">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Upload PDF Study Document</h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 max-w-md mx-auto">
              Extracts text preserving page numbers. Includes automatic Gemma 4 OCR fallback for scanned pages (up to 20MB).
            </p>
          </div>
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose PDF File
          </button>
        </div>
      )}

      {/* 2. IMAGE / DIAGRAM TAB */}
      {activeTab === 'image' && (
        <div className="p-6 rounded-3xl border-2 border-dashed border-indigo-200/80 hover:border-indigo-400 dark:border-stone-700/80 bg-indigo-50/20 dark:bg-stone-900/40 text-center space-y-3 transition-colors">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageUpload}
            className="hidden"
            id="image-file-upload"
          />
          <div className="mx-auto w-11 h-11 rounded-2xl bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shadow-xs">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Upload Textbook Image or Diagram</h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 max-w-md mx-auto">
              Gemma 4 describes the diagram visually, transcribes labels and handwritten notes, and extracts core concepts (PNG, JPEG, WebP, up to 10MB).
            </p>
          </div>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose Image File
          </button>
          {imagePreviewUrl && (
            <div className="mt-2 flex items-center justify-center">
              <img
                src={imagePreviewUrl}
                alt="Uploaded study diagram thumbnail"
                className="max-h-36 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. VIDEO LECTURE TAB */}
      {activeTab === 'video' && (
        <div className="p-5 rounded-3xl bg-stone-50/70 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 space-y-4">
          {/* YouTube Direct Video Understanding Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label htmlFor="video-url-input" className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Public YouTube Lecture URL</span>
              </label>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                <Globe className="w-3 h-3" />
                <span>Explaining in {language}</span>
                <span className="text-indigo-300 dark:text-indigo-600">•</span>
                <span>{simpleLanguage ? 'Simplified (ELI5)' : 'Standard'}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  id="video-url-input"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessing && videoUrl.trim()) {
                      e.preventDefault();
                      handleExplainVideo();
                    }
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[#1e1b24] dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 shadow-xs"
                />
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    title="Clear video URL"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                id="explain-video-btn"
                onClick={handleExplainVideo}
                disabled={isProcessing || !videoUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing video...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Explain this video</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start gap-1.5 pt-0.5 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Gemini 3.5 Flash watches the video frames and listens to spoken audio directly on the free tier (up to 8 hrs/day). Generates timestamped milestones, core concepts, and takeaways directly into the workspace below for editing and quizzes.
              </span>
            </div>
          </div>

          {/* Accessible Fallback: Subtitles & Transcripts */}
          <div className="pt-3 border-t border-stone-200/80 dark:border-stone-800 space-y-2">
            <label htmlFor="video-transcript-paste" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>Paste Video Transcript or Captions (SRT / VTT)</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                Accessible Fallback
              </span>
            </label>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              If the video is private, unlisted, restricted, or from Vimeo, copy the transcript (e.g. from YouTube &ldquo;Show Transcript&rdquo;) or paste subtitle text here.
            </p>
            <textarea
              id="video-transcript-paste"
              rows={3}
              value={videoTranscriptInput}
              onChange={(e) => setVideoTranscriptInput(e.target.value)}
              placeholder="Paste full video transcript or SRT/VTT subtitles here..."
              className="w-full rounded-xl p-3 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[#1e1b24] dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-stone-400"
            />
            {videoTranscriptInput.trim() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  id="load-transcript-btn"
                  onClick={handleLoadTranscript}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Load Transcript into Workspace
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. AUDIO FILE TAB */}
      {activeTab === 'audio' && (
        <div className="p-6 rounded-3xl border-2 border-dashed border-indigo-200/80 hover:border-indigo-400 dark:border-stone-700/80 bg-indigo-50/20 dark:bg-stone-900/40 text-center space-y-3 transition-colors">
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,video/mp4,video/webm"
            onChange={handleAudioUpload}
            className="hidden"
            id="audio-file-upload"
          />
          <div className="mx-auto w-11 h-11 rounded-2xl bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shadow-xs">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">Upload Lecture Audio / Video</h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 max-w-md mx-auto">
              Transcribes lecture clips automatically using Google&apos;s Gemini 3.5 Transcribe model (WAV, MP3, M4A, WebM up to 15MB). You can also paste transcripts directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose Audio File
          </button>
        </div>
      )}

      {/* EXTRACTED METADATA / SOURCE BADGE (Muted Sage Green) */}
      {extractedMeta && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-200/70 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                <span>Loaded from {extractedMeta.sourceType.toUpperCase()}:</span>
                <span className="font-mono text-stone-700 dark:text-stone-300 truncate max-w-xs">{extractedMeta.sourceName}</span>
                {extractedMeta.pageCount && (
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/60 dark:bg-emerald-900 text-[10px]">
                    {extractedMeta.pageCount} page{extractedMeta.pageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-emerald-800 dark:text-emerald-300/90 text-[11px] mt-0.5">
                {extractedMeta.warning || 'You can review and edit the extracted content below before generating explanations or quizzes.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-lg hover:bg-emerald-200/70 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 cursor-pointer"
            title="Clear and reset input"
            aria-label="Clear extracted content"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* REVIEWABLE STUDY MATERIAL TEXTAREA */}
      <div className="relative">
        <label htmlFor="study-material-textarea" className="sr-only">
          Study Material Text
        </label>
        <textarea
          id="study-material-textarea"
          rows={7}
          value={material}
          onChange={(e) => onMaterialChange(e.target.value)}
          placeholder="Paste lecture notes, or upload a PDF document, image diagram, or video transcript above..."
          className="w-full rounded-2xl p-4 text-sm bg-white dark:bg-stone-900/90 border border-stone-200 dark:border-stone-700/80 text-[#1e1b24] dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition-all font-sans leading-relaxed shadow-xs"
          aria-label="Study material content"
        />

        <div className="flex items-center justify-between mt-2 px-1 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <span>{material.length} characters</span>
            {material.length > 15000 && (
              <span className="text-indigo-600 dark:text-indigo-400 text-[11px] flex items-center gap-1">
                <Info className="w-3 h-3" />
                Long document: Gemma will synthesize core concepts safely.
              </span>
            )}
          </div>
          {material.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
            >
              Clear text
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
