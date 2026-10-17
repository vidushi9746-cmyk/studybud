import { QuizHistoryItem, StudySessionItem, SupportedLanguage, WeakConceptEntry } from '@/types/study';

const STORAGE_KEYS = {
  PREFERENCES: 'studybud_preferences_v1',
  WEAK_CONCEPTS: 'studybud_weak_concepts_v1',
  QUIZ_HISTORY: 'studybud_quiz_history_v1',
  STUDY_HISTORY: 'studybud_study_history_v1',
};

export interface UserPreferences {
  language: SupportedLanguage;
  simpleLanguage: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  dyslexicFont: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'English',
  simpleLanguage: false,
  fontSize: 'normal',
  highContrast: false,
  dyslexicFont: false,
};

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota exceeded or private mode
  }
}

export function loadStoredPreferences(): UserPreferences {
  const raw = safeGetItem(STORAGE_KEYS.PREFERENCES);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveStoredPreferences(prefs: UserPreferences): void {
  safeSetItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
}

export function getStoredWeakConcepts(): WeakConceptEntry[] {
  const raw = safeGetItem(STORAGE_KEYS.WEAK_CONCEPTS);
  if (!raw) return [];
  try {
    const list: WeakConceptEntry[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordMissedConcepts(concepts: string[]): WeakConceptEntry[] {
  if (!concepts || concepts.length === 0) return getStoredWeakConcepts();
  const current = getStoredWeakConcepts();
  const map = new Map<string, WeakConceptEntry>();

  for (const item of current) {
    map.set(item.concept.toLowerCase().trim(), item);
  }

  const now = Date.now();
  for (const c of concepts) {
    const clean = c.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastMissedAt = now;
      existing.concept = clean; // preserve latest casing
    } else {
      map.set(key, {
        concept: clean,
        count: 1,
        lastMissedAt: now,
      });
    }
  }

  const updated = Array.from(map.values()).sort((a, b) => b.count - a.count);
  safeSetItem(STORAGE_KEYS.WEAK_CONCEPTS, JSON.stringify(updated));
  return updated;
}

export function removeStoredWeakConcept(concept: string): WeakConceptEntry[] {
  const current = getStoredWeakConcepts();
  const updated = current.filter(
    (item) => item.concept.toLowerCase().trim() !== concept.toLowerCase().trim()
  );
  safeSetItem(STORAGE_KEYS.WEAK_CONCEPTS, JSON.stringify(updated));
  return updated;
}

export function clearStoredWeakConcepts(): void {
  safeSetItem(STORAGE_KEYS.WEAK_CONCEPTS, JSON.stringify([]));
}

export function getStoredQuizHistory(): QuizHistoryItem[] {
  const raw = safeGetItem(STORAGE_KEYS.QUIZ_HISTORY);
  if (!raw) return [];
  try {
    const list: QuizHistoryItem[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveQuizHistoryRecord(item: QuizHistoryItem): void {
  const history = getStoredQuizHistory();
  const updated = [item, ...history].slice(0, 20); // keep last 20
  safeSetItem(STORAGE_KEYS.QUIZ_HISTORY, JSON.stringify(updated));
}

export function getStoredStudyHistory(): StudySessionItem[] {
  const raw = safeGetItem(STORAGE_KEYS.STUDY_HISTORY);
  if (!raw) return [];
  try {
    const list: StudySessionItem[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveStudySessionRecord(item: StudySessionItem): void {
  const history = getStoredStudyHistory();
  const updated = [item, ...history].slice(0, 20); // keep last 20
  safeSetItem(STORAGE_KEYS.STUDY_HISTORY, JSON.stringify(updated));
}

export function clearAllLocalLearningData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.WEAK_CONCEPTS);
    localStorage.removeItem(STORAGE_KEYS.QUIZ_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.STUDY_HISTORY);
  } catch {
    // ignore
  }
}
