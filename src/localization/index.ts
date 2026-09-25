import { ru, TranslationDictionary } from './translations/ru';
import { uz } from './translations/uz';
import { en } from './translations/en';

export type Language = 'ru' | 'uz' | 'en';

export const LANGUAGES: Language[] = ['uz', 'ru', 'en'];

export const translations: Record<Language, TranslationDictionary> = { ru, uz, en };

export type { TranslationDictionary };
