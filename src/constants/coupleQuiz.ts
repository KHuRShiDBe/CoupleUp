import { TranslationKey } from '../localization/useTranslation';

export interface CoupleQuizQuestion {
  key: string;
  promptKey: TranslationKey;
}

// Each partner answers freely (not multiple choice) -- once both have
// answered a question, the two free-text answers are shown side by side.
// No score, no "compatibility percentage".
export const COUPLE_QUIZ_QUESTIONS: CoupleQuizQuestion[] = [
  { key: 'favoriteFood', promptKey: 'coupleQuiz.favoriteFood' },
  { key: 'favoritePlace', promptKey: 'coupleQuiz.favoritePlace' },
  { key: 'morningOrEvening', promptKey: 'coupleQuiz.morningOrEvening' },
  { key: 'seaOrMountains', promptKey: 'coupleQuiz.seaOrMountains' },
  { key: 'idealDate', promptKey: 'coupleQuiz.idealDate' },
];
