import { MoodValue } from '../types/database';

// Presentation order matches the 5-state picker: Грустно/Злюсь/Нормально/
// Хорошо/Счастлив(а). The underlying DB values (great/good/okay/tired/low)
// and table are untouched -- this is a pure label/emoji re-map, zero schema
// risk.
export const MOOD_OPTIONS: MoodValue[] = ['low', 'tired', 'okay', 'good', 'great'];

export const MOOD_EMOJI: Record<MoodValue, string> = {
  low: '😢',
  tired: '😠',
  okay: '😐',
  good: '🙂',
  great: '😍',
};

// Labels come from the translation dictionary (mood.great/good/okay/tired/low)
// via useTranslation() at the call site -- this map only gives a stable,
// theme-neutral order plus a fallback for anywhere a label is needed without
// pulling the full mood namespace key by key.
export const moodTranslationKey = (mood: MoodValue): `mood.${MoodValue}` => `mood.${mood}`;
