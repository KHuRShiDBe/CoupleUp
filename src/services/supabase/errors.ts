// Normalizes any error coming out of a Supabase call (JS error, PostgrestError,
// or a RAISE EXCEPTION code from one of our RPC functions) into one shape the
// rest of the app can render without knowing which layer failed.

import { WISH_ROULETTE_SPIN_COST_BOND } from '../../constants/wishRouletteConfig';

export class ServiceError extends Error {
  code: string;

  constructor(message: string, code = 'UNKNOWN') {
    super(message);
    this.code = code;
  }
}

const KNOWN_CODES = [
  'NOT_CONFIGURED',
  'INVALID_CODE',
  'EXPIRED_CODE',
  'OWN_CODE',
  'ALREADY_IN_COUPLE',
  'COUPLE_FULL',
  'NOT_A_MEMBER',
  'CANNOT_SELF_CONFIRM',
  'USER_BLOCKED',
  'TASK_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'PENALTY_NOT_FOUND',
  'ACTION_REQUEST_NOT_FOUND',
  'GOAL_NOT_FOUND',
  'NO_PARTNER',
  'NUDGE_RATE_LIMITED',
  'PROMISE_NOT_FOUND',
  'NOT_RECIPIENT',
  'INSUFFICIENT_BALANCE',
  'DAILY_ACTIONS_INCOMPLETE',
  'WHEEL_ALREADY_SPUN',
  'REQUEST_NOT_PENDING',
  'INVALID_PRICE',
  'OFFER_NOT_FOUND',
  'NOT_REQUESTER',
  'MILESTONE_NOT_REACHED',
  'CANNOT_COUNTER_OWN_OFFER',
  'OFFER_NOT_PENDING',
  'COUNTER_NOT_FOUND',
  'NOT_PROPOSER',
  'NOT_ASSIGNEE',
  'AGREEMENT_NOT_ACTIVE',
  'DEADLINE_NOT_PASSED',
  'NOT_A_PARTY',
  'INVALID_GENDER',
  'ROULETTE_NOT_ENOUGH_BOND',
  'ROULETTE_COOLDOWN',
  'DAILY_LIMIT_REACHED',
  'NO_COUPON_AVAILABLE',
  'MISSING_RESULT_KEY',
  'SHOP_ROULETTE_FEMALE_ONLY',
  'MILESTONES_NOT_AVAILABLE',
  'CHAT_MESSAGE_EMPTY',
  'ITEM_NOT_FOUND',
  'NOT_OWNER',
  'ITEM_NOT_AVAILABLE',
  'ITEM_NOT_PENDING',
];

export const toServiceError = (raw: unknown): ServiceError => {
  if (raw instanceof ServiceError) return raw;
  const message = raw instanceof Error ? raw.message : String(raw);
  const code = KNOWN_CODES.find((c) => message.includes(c)) ?? 'UNKNOWN';
  return new ServiceError(message, code);
};

const FRIENDLY_MESSAGES: Record<string, string> = {
  NOT_CONFIGURED: 'Backend не настроен. Заполните .env и перезапустите приложение.',
  INVALID_CODE: 'Такого кода пары не существует. Проверьте код и попробуйте снова.',
  EXPIRED_CODE: 'Срок действия этого кода истёк. Попросите партнёра создать новый.',
  OWN_CODE: 'Это ваш собственный код — его нужно ввести на телефоне партнёра.',
  ALREADY_IN_COUPLE: 'Вы уже состоите в паре.',
  COUPLE_FULL: 'В этой паре уже два человека.',
  NOT_A_MEMBER: 'Вы не состоите в этой паре.',
  CANNOT_SELF_CONFIRM: 'Вы не можете подтвердить собственный запрос — это должен сделать партнёр.',
  USER_BLOCKED: 'Связь с этим пользователем невозможна.',
  TASK_NOT_FOUND: 'Задание не найдено.',
  REQUEST_NOT_FOUND: 'Запрос не найден.',
  PENALTY_NOT_FOUND: 'Штраф не найден.',
  ACTION_REQUEST_NOT_FOUND: 'Запрос на подтверждение не найден.',
  GOAL_NOT_FOUND: 'Цель не найдена.',
  NO_PARTNER: 'Партнёр ещё не подключён.',
  NUDGE_RATE_LIMITED: 'Вы уже недавно напоминали об этом партнёру. Попробуйте позже.',
  PROMISE_NOT_FOUND: 'Обещание не найдено.',
  NOT_RECIPIENT: 'Это может подтвердить только адресат.',
  INSUFFICIENT_BALANCE: 'У партнёра недостаточно баллов для этой награды.',
  DAILY_ACTIONS_INCOMPLETE: 'Сначала выполните все сегодняшние действия.',
  WHEEL_ALREADY_SPUN: 'Колесо сегодня уже использовано.',
  REQUEST_NOT_PENDING: 'Этот запрос уже обработан.',
  INVALID_PRICE: 'Укажите корректную цену.',
  OFFER_NOT_FOUND: 'Предложение не найдено.',
  NOT_REQUESTER: 'Ответить на предложение может только автор запроса.',
  MILESTONE_NOT_REACHED: 'Этот рубеж ещё не достигнут.',
  CANNOT_COUNTER_OWN_OFFER: 'Нельзя торговаться со своим же предложением.',
  OFFER_NOT_PENDING: 'Это предложение уже обработано.',
  COUNTER_NOT_FOUND: 'Встречное предложение не найдено.',
  NOT_PROPOSER: 'Ответить на встречное предложение может только автор.',
  NOT_ASSIGNEE: 'Отметить выполненным может только исполнитель.',
  AGREEMENT_NOT_ACTIVE: 'Этот договор уже неактивен.',
  DEADLINE_NOT_PASSED: 'Срок ещё не истёк.',
  NOT_A_PARTY: 'Вы не участник этого договора.',
  INVALID_GENDER: 'Некорректный выбор рулетки.',
  // Shared by both roulettes' RPCs (same exception name) -- each screen
  // that can throw it overrides this generic wording with its own actual
  // cost before showing the message (see WishRouletteScreen/IntimateRouletteScreen).
  ROULETTE_NOT_ENOUGH_BOND: `Недостаточно BOND для вращения. Нужно ${WISH_ROULETTE_SPIN_COST_BOND} BOND.`,
  NO_COUPON_AVAILABLE: 'У вас нет доступных купонов на бесплатное вращение.',
  SHOP_ROULETTE_FEMALE_ONLY: 'Рулетка магазина доступна только для женского аккаунта.',
  MILESTONES_NOT_AVAILABLE: 'Бонусные ступени доступны только для ежедневных и еженедельных заданий.',
  CHAT_MESSAGE_EMPTY: 'Сообщение не может быть пустым.',
  ITEM_NOT_FOUND: 'Приз не найден.',
  NOT_OWNER: 'Использовать этот приз может только его владелец.',
  ITEM_NOT_AVAILABLE: 'Этот приз уже использован или ожидает подтверждения.',
  ITEM_NOT_PENDING: 'Этот запрос уже обработан.',
  ROULETTE_COOLDOWN: 'Рулетку можно крутить один раз в 48 часов.',
  DAILY_LIMIT_REACHED: 'Дневной лимит 5 BOND за задания и бонусы уже достигнут. Возвращайтесь завтра.',
  // PostgREST PGRST202: the RPC is missing on the server (a migration was not applied).
  'Could not find the function': 'Функция на сервере не найдена — нужно применить миграцию Supabase.',
  'Invalid login credentials': 'Неверный email или пароль.',
  'User already registered': 'Пользователь с таким email уже зарегистрирован.',
  'Password should be at least 6 characters': 'Пароль должен быть не короче 6 символов.',
};

export const friendlyMessage = (err: ServiceError): string => {
  if (/network|fetch|timeout/i.test(err.message)) {
    return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
  }
  const byMessage = Object.keys(FRIENDLY_MESSAGES).find((key) => err.message.includes(key));
  if (byMessage) return FRIENDLY_MESSAGES[byMessage];
  return FRIENDLY_MESSAGES[err.code] ?? err.message;
};
