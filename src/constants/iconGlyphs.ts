import { Ionicons } from '@expo/vector-icons';
import { IconName } from '../types';

// Flat/linear glyph per icon name -- the SAME shape for male and female
// (only IconImage's color differs by role). Ionicons' "outline" set matches
// the flat/minimal, single-stroke-weight look this replaces the old 3D/glossy
// PNGs with. This is the one place to repoint when real downloaded Flaticon
// assets are ready to drop in -- every call site still just does
// <IconImage name="..." />, nothing else needs to change.
export const ICON_GLYPHS: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  history: 'time-outline',
  add: 'add-circle-outline',
  rewards: 'gift-outline',
  profile: 'person-outline',
  settings: 'settings-outline',
  notification: 'notifications-outline',
  message: 'mail-outline',
  chat: 'chatbubbles-outline',
  tasks: 'checkbox-outline',
  achievement: 'trophy-outline',
  back: 'chevron-back-outline',
  pair: 'people-outline',
  goal: 'flag-outline',
  shop: 'cart-outline',
  lock: 'lock-closed-outline',
  periodDaily: 'today-outline',
  periodWeekly: 'calendar-outline',
  periodMonthly: 'calendar-number-outline',
  periodYearly: 'calendar-clear-outline',
  // Segmented circle -- reads as a wheel with sectors, closer to an actual
  // roulette wheel than a plain disc (Ionicons has no literal casino-wheel
  // glyph).
  roulette: 'pie-chart-outline',
  savings: 'wallet-outline',
  wishlist: 'heart-outline',
  board: 'brush-outline',
  // Same heart family as `wishlist`, half-filled so the two wishlist cards
  // (mine vs partner's) are still visually distinguishable at a glance.
  partnerWishlist: 'heart-half-outline',
};
