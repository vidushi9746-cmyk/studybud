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
} from 'lucide-react';
import { MaterialSourceType, ExtractedMaterial, SupportedLanguage } from '@/types/study';
import { SAMPLE_LESSONS } from '@/lib/sampleLessons';

interface UnifiedMaterialInputProps {
  material: string;
  onMaterialChange: (val: string) => void;
  extractedMeta: ExtractedMaterial | null;
  onExtractedMetaChange: (meta: ExtractedMaterial | null) => void;
  onLoadSample: (sampleId: string) => void;
}

export default function UnifiedMaterialInput({
  material,
  onMaterialChange,
  extractedMeta,
  onExtractedMetaChange,
  onLoadSample,
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

  // 3. Handle Video URL / Transcript
  const handleProcessVideo = async () => {
    if (!videoUrl.trim() && !videoTranscriptInput.trim()) {
      setUploadError('Please provide a video URL or paste its transcript.');
      return;
    }

    setUploadError(null);
    setIsProcessing(true);
    setProcessingStatus('Processing video material...');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video_url',
          videoUrl: videoUrl.trim() || undefined,
          transcriptText: videoTranscriptInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        onMaterialChange(data.text);
        onExtractedMetaChange({
          sourceType: 'video',
          sourceName: data.sourceName,
          text: data.text,
        });
        setProcessingStatus('');
      } else {
        // Honest guidance when direct automated captions cannot be fetched
        setUploadError(data.warning || data.details || 'Automated caption scraping is restricted for this video link. Please copy and paste the video transcript into the field below.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error processing video.');
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
        <div className="p-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div>
            <label htmlFor="video-url-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Video URL (YouTube, Vimeo, or educational link)
            </label>
            <div className="flex gap-2">
              <input
                id="video-url-input"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleProcessVideo}
                disabled={isProcessing || !videoUrl.trim()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                Fetch
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="video-transcript-paste" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
              <span>Paste Video Transcript or Subtitles</span>
              <span className="text-[11px] font-normal text-zinc-500">Accessible Fallback</span>
            </label>
            <textarea
              id="video-transcript-paste"
              rows={4}
              value={videoTranscriptInput}
              onChange={(e) => setVideoTranscriptInput(e.target.value)}
              placeholder="If the video's automated captions cannot be fetched directly, copy the transcript (e.g. YouTube 'Show Transcript') and paste it here..."
              className="w-full rounded-xl p-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {videoTranscriptInput.trim() && (
              <button
                type="button"
                onClick={handleProcessVideo}
                className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs"
              >
                Load Transcript into Workspace
              </button>
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
