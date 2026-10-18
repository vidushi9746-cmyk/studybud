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
      {/* Accessible Source Selector Tabs */}
      <div
        className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl"
        role="tablist"
        aria-label="Study material input source options"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'text'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>Pasted Text</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pdf'}
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'pdf'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <FileUp className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>PDF Upload</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'image'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>Image / Diagram</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'video'}
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'video'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Video className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>Video Lecture</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audio'}
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
            activeTab === 'audio'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>Audio File</span>
        </button>
      </div>

      {/* Screen Reader and Visual Processing Status */}
      <div aria-live="polite" className="text-xs">
        {isProcessing && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">{processingStatus}</span>
          </div>
        )}
        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Extraction Notice</span>
              {uploadError}
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-xs hover:underline text-rose-700"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 1. PDF UPLOAD TAB */}
      {activeTab === 'pdf' && (
        <div className="p-5 rounded-2xl border-2 border-dashed border-amber-200 dark:border-zinc-700 bg-amber-50/30 dark:bg-zinc-950/40 text-center space-y-3">
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handlePdfUpload}
            className="hidden"
            id="pdf-file-upload"
          />
          <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload PDF Study Document</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Extracts text preserving page numbers. Includes automatic Gemma 4 OCR fallback for scanned pages (up to 20MB).
            </p>
          </div>
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose PDF File
          </button>
        </div>
      )}

      {/* 2. IMAGE / DIAGRAM TAB */}
      {activeTab === 'image' && (
        <div className="p-5 rounded-2xl border-2 border-dashed border-amber-200 dark:border-zinc-700 bg-amber-50/30 dark:bg-zinc-950/40 text-center space-y-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageUpload}
            className="hidden"
            id="image-file-upload"
          />
          <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload Textbook Image or Diagram</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Gemma 4 will describe the diagram visually, transcribe labels and handwritten notes, and extract concepts (PNG, JPEG, WebP, up to 10MB).
            </p>
          </div>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose Image File
          </button>
          {imagePreviewUrl && (
            <div className="mt-2 flex items-center justify-center">
              <img
                src={imagePreviewUrl}
                alt="Uploaded study diagram thumbnail"
                className="max-h-36 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. VIDEO LECTURE TAB */}
      {activeTab === 'video' && (
        <div className="p-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 space-y-4">
          {/* YouTube Direct Video Understanding Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label htmlFor="video-url-input" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-amber-500" />
                <span>Public YouTube Lecture URL</span>
              </label>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                <Globe className="w-3 h-3" />
                <span>Explaining in {language}</span>
                <span className="text-amber-400 dark:text-amber-600">•</span>
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
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 pr-8 shadow-xs"
                />
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    title="Clear video URL"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded-md"
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
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500 shrink-0 cursor-pointer disabled:cursor-not-allowed"
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

            <div className="flex items-start gap-1.5 pt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Gemini 3.5 Flash watches the video frames and listens to spoken audio directly on the free tier (up to 8 hrs/day). Generates timestamped milestones, core concepts, and takeaways directly into the workspace below for editing and quizzes.
              </span>
            </div>
          </div>

          {/* Accessible Fallback: Subtitles & Transcripts */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <label htmlFor="video-transcript-paste" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>Paste Video Transcript or Captions (SRT / VTT)</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Accessible Fallback
              </span>
            </label>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              If the video is private, unlisted, restricted, or from Vimeo, copy the transcript (e.g. from YouTube &ldquo;Show Transcript&rdquo;) or paste subtitle text here.
            </p>
            <textarea
              id="video-transcript-paste"
              rows={3}
              value={videoTranscriptInput}
              onChange={(e) => setVideoTranscriptInput(e.target.value)}
              placeholder="Paste full video transcript or SRT/VTT subtitles here..."
              className="w-full rounded-xl p-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-400"
            />
            {videoTranscriptInput.trim() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  id="load-transcript-btn"
                  onClick={handleLoadTranscript}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
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
        <div className="p-5 rounded-2xl border-2 border-dashed border-amber-200 dark:border-zinc-700 bg-amber-50/30 dark:bg-zinc-950/40 text-center space-y-3">
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,video/mp4,video/webm"
            onChange={handleAudioUpload}
            className="hidden"
            id="audio-file-upload"
          />
          <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload Lecture Audio / Video</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Transcribes lecture clips automatically using Google&apos;s Gemini 3.5 Transcribe model (WAV, MP3, M4A, WebM up to 15MB). You can also paste transcripts directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition-all inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Choose Audio File
          </button>
        </div>
      )}

      {/* EXTRACTED METADATA / SOURCE BADGE */}
      {extractedMeta && (
        <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="p-1 rounded-lg bg-amber-200/70 dark:bg-amber-900 text-amber-900 dark:text-amber-100 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <span>Loaded from {extractedMeta.sourceType.toUpperCase()}:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-xs">{extractedMeta.sourceName}</span>
                {extractedMeta.pageCount && (
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-200/60 dark:bg-amber-900 text-[10px]">
                    {extractedMeta.pageCount} page{extractedMeta.pageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-amber-800 dark:text-amber-300/90 text-[11px] mt-0.5">
                {extractedMeta.warning || 'You can review and edit the extracted content below before generating explanations or quizzes.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-lg hover:bg-amber-200/70 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300"
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
          className="w-full rounded-2xl p-4 text-sm bg-zinc-50/80 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y transition-all font-sans leading-relaxed"
          aria-label="Study material content"
        />

        <div className="flex items-center justify-between mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>{material.length} characters</span>
            {material.length > 15000 && (
              <span className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1">
                <Info className="w-3 h-3" />
                Long document: Gemma will synthesize core concepts safely.
              </span>
            )}
          </div>
          {material.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              Clear text
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
