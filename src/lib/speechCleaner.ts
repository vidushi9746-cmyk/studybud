/**
 * Speech Cleaner Utility for StudyBud
 *
 * Prepares raw study materials, AI explanations, and revision notes for
 * browser SpeechSynthesis by stripping emojis, decorative pictographs, and
 * markdown formatting while preserving natural sentence pauses, numbered steps,
 * and mathematical/scientific expressions.
 */

// Matches emojis, pictographs, variation selectors, zero-width joiners,
// skin-tone modifiers, keycap sequences, flags, and decorative symbols.
// NOTE: We do NOT use bare \p{Emoji_Component} because in Unicode that matches ASCII digits 0-9.
const EMOJI_AND_PICTOGRAPHS_REGEX =
  /(?:[0-9#*][\uFE00-\uFE0F]?\u20E3|[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|[\uFE00-\uFE0F]|\u200D|[\u2300-\u23FF]|[\u2600-\u27BF]|[\u2B50-\u2B55]|[\u200B-\u200F\uFEFF])/gu;

/**
 * Clean text for browser SpeechSynthesis.
 * Does NOT alter the text displayed on screen.
 */
export function cleanTextForSpeech(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let text = raw;

  // 1. Remove markdown images: ![alt](url) -> empty
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 2. Convert markdown links: [link text](url) -> link text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 3. Remove fenced code blocks while keeping inner code: ```ts ... ``` -> ...
  text = text.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, '$1');

  // 4. Remove inline code backticks: `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // 5. Remove blockquote markers at start of lines: > quote -> quote
  text = text.replace(/^[ \t]*>[ \t]?/gm, '');

  // 6. Remove horizontal rules: --- or *** or ___
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');

  // 7. Clean Markdown Headings (# Heading -> Heading)
  text = text.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)$/gm, (_match, headingText) => {
    const trimmed = headingText.trim();
    // Add period at end of heading if no punctuation exists, so it pauses before next paragraph
    return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  });

  // 8. Replace variable subscripts for smoother speech before processing italics: e.g. Q_s -> Q s
  text = text.replace(/([a-zA-Z])_([a-zA-Z0-9]+)/g, '$1 $2');

  // 9. Remove bold, italic, and strikethrough markers (**bold**, *italic*, __bold__, _italic_, ~~strike~~)
  // Repeat to handle nested formatting like ***bold italic***
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/___([^_]+)___/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[\s(])_([^_ \t\r\n]+)_(?=[\s).,!?:;]|$)/gm, '$1$2');
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // 10. Remove unordered bullet markers (*, -, +) at line starts, but PRESERVE numbered lists (1. , 2. )
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, '');

  // 10. Replace directional arrows and process symbols for natural speech:
  // Processes and chemical reactions: Sunlight → Chlorophyll -> yields
  text = text.replace(/[ \t]*(?:➔|→|-->|->)[ \t]*/g, ' yields ');
  text = text.replace(/[ \t]*(?:<--|<-|←)[ \t]*/g, ' is produced from ');
  text = text.replace(/[ \t]*↔[ \t]*/g, ' is in equilibrium with ');
  text = text.replace(/\(\s*↑\s*([a-zA-Z0-9]+)\s*\)/g, ' increasing $1 ');
  text = text.replace(/\(\s*↓\s*([a-zA-Z0-9]+)\s*\)/g, ' decreasing $1 ');
  text = text.replace(/[ \t]*↑[ \t]*/g, ' increases ');
  text = text.replace(/[ \t]*↓[ \t]*/g, ' decreases ');

  // 11. Clean LaTeX math markup into natural speech:
  text = text.replace(/\\text\{([^}]+)\}/g, '$1');
  text = text.replace(/\\times/g, ' times ');
  text = text.replace(/\\pm/g, ' plus or minus ');
  text = text.replace(/\\approx/g, ' approximately ');
  text = text.replace(/\\le(?:q)?/g, ' less than or equal to ');
  text = text.replace(/\\ge(?:q)?/g, ' greater than or equal to ');
  text = text.replace(/\\neq/g, ' not equal to ');
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2');
  text = text.replace(/\\[a-zA-Z]+/g, ''); // strip remaining bare LaTeX commands

  // 12. Strip math delimiter dollar signs ($$ and $), but PRESERVE currency ($50, $100):
  text = text.replace(/\$\$/g, '');
  text = text.replace(/\$(?!\d)/g, '');

  // 13. Remove all emojis, pictographs, variation selectors, zero-width joiners
  text = text.replace(EMOJI_AND_PICTOGRAPHS_REGEX, '');

  // 14. Split lines, ensure line-level sentences end with punctuation for natural speech pauses
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // If the line doesn't end with sentence-ending punctuation or a colon/comma, append a period
    if (!/[.!?:]$/.test(trimmed)) {
      cleanedLines.push(`${trimmed}.`);
    } else {
      cleanedLines.push(trimmed);
    }
  }

  text = cleanedLines.join(' ');

  // 13. Clean up any unintended repeated punctuation (e.g. "..", " .", "?.")
  text = text.replace(/\s+([.,!?:])/g, '$1');
  text = text.replace(/\.{2,}/g, '.');
  text = text.replace(/([!?])\./g, '$1');

  // 14. Normalize multiple whitespaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
