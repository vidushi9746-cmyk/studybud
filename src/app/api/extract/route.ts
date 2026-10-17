import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { extractText } from 'unpdf';
import { ExtractApiRequest, ExtractApiResponse } from '@/types/study';
import { transcribeMedia } from '@/lib/transcriptionAdapter';

function getEnvConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMMA_MODEL?.trim() || 'gemma-4-26b-a4b-it';
  return { apiKey, modelName };
}

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export async function POST(req: Request) {
  let body: ExtractApiRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const { type, fileBase64, mimeType = '', fileName = 'document', videoUrl, transcriptText } = body;
  const { apiKey, modelName } = getEnvConfig();

  // -------------------------------------------------------------
  // 1. PDF EXTRACTION
  // -------------------------------------------------------------
  if (type === 'pdf') {
    if (!fileBase64) {
      return NextResponse.json(
        { success: false, error: 'No PDF file data provided.' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid base64 encoding for PDF.' },
        { status: 400 }
      );
    }

    if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF file exceeds size limit',
          details: `The uploaded PDF (${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB) exceeds the 20MB limit.`,
        },
        { status: 400 }
      );
    }

    // Step A: Extract embedded digital text using unpdf (PDF.js standard parser)
    let embeddedText = '';
    let pageCount = 1;

    try {
      const { totalPages, text: pageTexts } = await extractText(new Uint8Array(buffer));
      pageCount = totalPages || 1;

      if (Array.isArray(pageTexts) && pageTexts.length > 0) {
        embeddedText = pageTexts
          .map((p, idx) => `--- Page ${idx + 1} ---\n${(p || '').trim()}`)
          .filter((t) => t.replace(/--- Page \d+ ---|\s/g, '').length > 0)
          .join('\n\n')
          .trim();
      }
    } catch (err: any) {
      // Fall through to OCR fallback
    }

    // Check if embedded text is substantial
    const hasSufficientEmbeddedText = embeddedText.replace(/--- Page \d+ ---|\s/g, '').length >= 30;

    if (hasSufficientEmbeddedText) {
      return NextResponse.json({
        success: true,
        sourceType: 'pdf',
        sourceName: fileName,
        text: embeddedText,
        pageCount,
        isScannedPdf: false,
      } as ExtractApiResponse);
    }

    // Step B: Scanned PDF Fallback via Gemma 4 Multimodal OCR
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Scanned PDF with no embedded text',
          details: 'This PDF does not contain embedded digital text, and GEMINI_API_KEY is not configured for OCR fallback.',
        },
        { status: 422 }
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are StudyBud's accessible PDF document transcriber. 
This PDF appears to be a scanned document or has non-embedded text.
Carefully transcribe all readable text, section headings, numbers, and key formulas from the pages of this document.
Preserve the page structure where possible with "--- Page X ---".
If the document contains no readable text, symbols, or handwriting, respond EXACTLY with: NO_READABLE_TEXT.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: fileBase64 } },
              { text: prompt },
            ],
          },
        ],
      });

      const ocrText = (response.text || '').trim();

      if (!ocrText || ocrText.includes('NO_READABLE_TEXT')) {
        return NextResponse.json(
          {
            success: false,
            error: 'No readable text found',
            details: 'We scanned this PDF with Gemma 4, but no readable text or handwriting could be detected.',
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        sourceType: 'pdf',
        sourceName: fileName,
        text: ocrText,
        pageCount,
        isScannedPdf: true,
        warning: 'Extracted via Gemma 4 OCR (scanned document). Please review before studying.',
      } as ExtractApiResponse);
    } catch (ocrErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF extraction failed',
          details: `Embedded text extraction yielded no readable text, and OCR fallback encountered an error: ${ocrErr.message || ocrErr}`,
        },
        { status: 502 }
      );
    }
  }

  // -------------------------------------------------------------
  // 2. IMAGE & DIAGRAM ACCESSIBILITY / OCR
  // -------------------------------------------------------------
  if (type === 'image') {
    if (!fileBase64) {
      return NextResponse.json(
        { success: false, error: 'No image data provided.' },
        { status: 400 }
      );
    }

    const normalizedMime = mimeType.toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.some((t) => normalizedMime.includes(t.replace('image/', '')))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported image format',
          details: `Format "${mimeType}" is not supported. Supported image formats: PNG, JPEG, WebP, GIF.`,
        },
        { status: 400 }
      );
    }

    const approxSizeBytes = (fileBase64.length * 3) / 4;
    if (approxSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'Image file too large',
          details: 'Image exceeds the maximum allowed size of 10MB.',
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          details: 'GEMINI_API_KEY is required to analyze diagrams and perform OCR on images.',
        },
        { status: 500 }
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are StudyBud's accessible vision and diagram reader for students.
Analyze this uploaded study image (which may be a textbook diagram, handwritten notes, a scientific illustration, or a formula).

Provide an objective, highly accessible educational breakdown:
1. 🖼️ Visual & Diagram Description: Describe the visual layout, components, shapes, and structural relationships (without inventing unseen details).
2. 📝 Transcribed Text & Labels: Accurately transcribe all visible text, handwritten notes, labels, and mathematical formulas.
3. 💡 Key Academic Takeaways: Summarize the core scientific or educational concepts represented in the diagram or notes.

Be precise, student-friendly, and faithful to what is visibly present.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { inlineData: { mimeType: normalizedMime || 'image/png', data: fileBase64 } },
              { text: prompt },
            ],
          },
        ],
      });

      const extractedDescription = response.text || '';

      if (!extractedDescription.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'No content recognized',
            details: 'Gemma 4 was unable to extract any text or diagram features from this image.',
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        sourceType: 'image',
        sourceName: fileName,
        description: 'Visual diagram description and extracted text generated by Gemma 4.',
        text: extractedDescription,
      } as ExtractApiResponse);
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: 'Image analysis error',
          details: err.message || 'Error occurred while analyzing image with Gemma.',
        },
        { status: 502 }
      );
    }
  }

  // -------------------------------------------------------------
  // 3. VIDEO URL & TRANSCRIPTS
  // -------------------------------------------------------------
  if (type === 'video_url') {
    if (!videoUrl || !videoUrl.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid video URL.' },
        { status: 400 }
      );
    }

    const cleanUrl = videoUrl.trim();
    try {
      new URL(cleanUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format.', details: 'Please enter a valid HTTP or HTTPS video URL.' },
        { status: 400 }
      );
    }

    if (transcriptText && transcriptText.trim().length > 0) {
      return NextResponse.json({
        success: true,
        sourceType: 'video',
        sourceName: cleanUrl,
        text: transcriptText.trim(),
      } as ExtractApiResponse);
    }

    const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
    const isVimeo = cleanUrl.includes('vimeo.com');

    return NextResponse.json({
      success: false,
      sourceType: 'video',
      sourceName: cleanUrl,
      text: '',
      warning: isYouTube || isVimeo
        ? 'Direct automated caption scraping is restricted by external video platforms. Please copy the video transcript or subtitle text (e.g. from the video "Show Transcript" button) and paste it below.'
        : 'Automated subtitles could not be retrieved from this link. Please paste the lecture transcript directly into the workspace.',
      details: 'StudyBud provides full learning, quiz, and adaptive revision once transcript text is supplied.',
    } as ExtractApiResponse);
  }

  // -------------------------------------------------------------
  // 4. AUDIO / VIDEO MEDIA UPLOAD
  // -------------------------------------------------------------
  if (type === 'audio') {
    if (!fileBase64) {
      return NextResponse.json(
        { success: false, error: 'No audio/video file data provided.' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid base64 encoding for audio file.' },
        { status: 400 }
      );
    }

    const result = await transcribeMedia(new Uint8Array(buffer), mimeType, fileName);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Audio transcription unavailable',
          details: result.details || 'Speech-to-text service is not configured.',
          warning: result.requiresManualInput
            ? 'You can paste the audio or lecture transcript directly into the workspace.'
            : undefined,
        },
        { status: result.requiresManualInput ? 422 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sourceType: 'audio',
      sourceName: fileName,
      text: result.text || '',
    } as ExtractApiResponse);
  }

  return NextResponse.json(
    { success: false, error: `Unsupported extraction type: "${type}"` },
    { status: 400 }
  );
}
