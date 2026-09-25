import { CoupleLevelInfo } from '../types';

// Deterministic "day index" so everyone sees the same daily question/challenge
// on a given calendar day, without needing a server.
const dayIndex = (mod: number): number => {
  const start = Date.UTC(2024, 0, 1);
  const days = Math.floor((Date.now() - start) / 86400000);
  return ((days % mod) + mod) % mod;
};

export const DAILY_QUESTIONS: string[] = [
  'За что ты сегодня благодарен партнёру?',
  'Какой момент вместе ты хочешь повторить?',
  'Что я могу сделать для тебя завтра?',
  'Какой наш момент самый смешной?',
  'Куда ты хочешь поехать вместе?',
];

export const DAILY_CHALLENGES: string[] = [
  'Сделай комплимент',
  'Обними партнёра',
  'Устрой 20 минут без телефонов',
  'Сделай маленький сюрприз',
  'Помоги с одним делом',
];

export const getDailyQuestion = (): string => DAILY_QUESTIONS[dayIndex(DAILY_QUESTIONS.length)];
export const getDailyChallenge = (): string => DAILY_CHALLENGES[dayIndex(DAILY_CHALLENGES.length)];

// ---- Couple Daily Mini Challenge -- real, shared, backend-tracked --------
// (see migration 0013 public.daily_challenges). Distinct from the local-only
// DAILY_CHALLENGES above: the *text* is still deterministic client-side
// content (identical for both partners on the same day), but *completion*
// is a real row either partner can mark, visible to both.

export const COUPLE_DAILY_CHALLENGE_KEYS = ['thanks', 'kindAction', 'phoneFree15', 'askQuestion', 'doTogether'] as const;
export type CoupleDailyChallengeKey = (typeof COUPLE_DAILY_CHALLENGE_KEYS)[number];

export const getCoupleDailyChallengeKey = (date: Date = new Date()): CoupleDailyChallengeKey => {
  const start = Date.UTC(2024, 0, 1);
  const days = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  const idx = ((days % COUPLE_DAILY_CHALLENGE_KEYS.length) + COUPLE_DAILY_CHALLENGE_KEYS.length) % COUPLE_DAILY_CHALLENGE_KEYS.length;
  return COUPLE_DAILY_CHALLENGE_KEYS[idx];
};

// ---- Couple level ---------------------------------------------------------

export const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000];

export const computeCoupleLevel = (earnedPoints: number): CoupleLevelInfo => {
  let levelIndex = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (earnedPoints >= LEVEL_THRESHOLDS[i]) levelIndex = i;
  }
  const currentThreshold = LEVEL_THRESHOLDS[levelIndex];
  const nextThreshold = LEVEL_THRESHOLDS[levelIndex + 1] ?? null;
  const progress = nextThreshold ? (earnedPoints - currentThreshold) / (nextThreshold - currentThreshold) : 1;
  return {
    level: levelIndex + 1,
    currentPoints: earnedPoints,
    currentThreshold,
    nextThreshold,
    progress: Math.min(1, Math.max(0, progress)),
    remaining: nextThreshold ? Math.max(0, nextThreshold - earnedPoints) : 0,
  };
};

// ---- "Кто лучше знает партнёра?" quizzes -----------------------------------

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export type QuizId = 'partner-1' | 'partner-2';

export const PARTNER_QUIZZES: Record<QuizId, { title: string; questions: QuizQuestion[] }> = {
  'partner-1': {
    title: 'Кто лучше знает партнёра?',
    questions: [
      { question: 'Любимый напиток партнёра?', options: ['Кофе', 'Чай', 'Сок', 'Вода'], correctIndex: 0 },
      { question: 'Идеальный отдых?', options: ['Пляж', 'Горы', 'Город', 'Дома'], correctIndex: 1 },
      { question: 'Любимая еда?', options: ['Паста', 'Суши', 'Пицца', 'Салат'], correctIndex: 2 },
      {
        question: 'Что сильнее всего раздражает?',
        options: ['Опоздания', 'Шум', 'Беспорядок', 'Грубость'],
        correctIndex: 0,
      },
      {
        question: 'Какой подарок больше понравится?',
        options: ['Цветы', 'Гаджет', 'Впечатления', 'Украшение'],
        correctIndex: 2,
      },
    ],
  },
  'partner-2': {
    title: 'Насколько хорошо ты меня знаешь?',
    questions: [
      {
        question: 'Куда партнёр мечтает поехать?',
        options: ['Италия', 'Япония', 'Исландия', 'Мальдивы'],
        correctIndex: 1,
      },
      { question: 'Любимый фильм партнёра?', options: ['Комедия', 'Драма', 'Фантастика', 'Триллер'], correctIndex: 2 },
      { question: 'Чем партнёр увлекается?', options: ['Спорт', 'Музыка', 'Рисование', 'Готовка'], correctIndex: 3 },
      { question: 'Любимое время года партнёра?', options: ['Весна', 'Лето', 'Осень', 'Зима'], correctIndex: 1 },
      { question: 'О чём партнёр мечтает?', options: ['Своё дело', 'Путешествия', 'Дом', 'Семья'], correctIndex: 0 },
    ],
  },
};

// ---- "Выбери одно из двух" -------------------------------------------------

export const EITHER_OR_PAIRS: [string, string][] = [
  ['Море', 'Горы'],
  ['Кино', 'Прогулка'],
  ['Утро', 'Ночь'],
  ['Ресторан', 'Домашний ужин'],
  ['Сюрприз', 'Заранее запланировано'],
  ['Чай', 'Кофе'],
  ['Книга', 'Фильм'],
  ['Активный отдых', 'Пляжный отдых'],
  ['Городской шум', 'Тишина природы'],
  ['Сладкое', 'Солёное'],
];

// ---- "Правда или действие" -------------------------------------------------

export const TRUTH_PROMPTS: string[] = [
  'Какое твоё самое яркое воспоминание о нас?',
  'Что тебе нравится во мне больше всего?',
  'Какая твоя тайная мечта?',
  'Что бы ты изменил в наших отношениях?',
  'Какой был твой первый шаг ко мне?',
  'Чего ты больше всего боишься в отношениях?',
];

export const DARE_PROMPTS: string[] = [
  'Обними партнёра на 20 секунд',
  'Скажи 3 комплимента подряд',
  'Станцуй под любимую песню партнёра',
  'Спой строчку любимой песни',
  'Сделай смешное селфи вместе',
  'Расскажи анекдот партнёру',
];

// Deterministic prompt pick, seeded by (coupleId, round, kind) instead of
// Math.random() -- both phones compute the SAME index for the same shared
// round/kind (from truth_or_dare_progress, migration 0018), without the
// prompt text itself ever needing to be stored server-side. Simple string
// hash (DJB2), not cryptographic -- only needs to be stable and well-mixed.
const hashString = (input: string): number => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
};

export const pickDeterministicPrompt = (coupleId: string, round: number, kind: 'truth' | 'dare'): string => {
  const pool = kind === 'truth' ? TRUTH_PROMPTS : DARE_PROMPTS;
  const index = hashString(`${coupleId}:${round}:${kind}`) % pool.length;
  return pool[index];
};
