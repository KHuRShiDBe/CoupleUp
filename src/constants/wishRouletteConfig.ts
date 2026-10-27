// Wish Roulette -- two gendered 20-sector wheels (see WishRouletteScreen).
// Kept in sync BY HAND with the pool hardcoded inside spin_wish_roulette
// (supabase/migrations/0029_wish_roulette_inventory_economy.sql): the RPC is
// the only thing that ever picks a winner (it holds the real stakes), this
// file only knows how to *display* whatever item_key the RPC returns --
// title, icon, rarity and value all come from here, keyed by item.key.
//
// Only 'x10' items are real money prizes (credited as BOND) -- everything
// else is a wish, saved to wish_inventory, never converted to BOND. See
// WishRouletteScreen's result modal, which branches on `rarity === 'x10'`.

export type WishRarity = 'cheap' | 'almostBreakeven' | 'x1' | 'x3' | 'x10';

export interface WishRouletteItem {
  key: string;
  // Translation key suffix -> wishRoulette.item_<titleKey>
  titleKey: string;
  emoji: string;
  rarity: WishRarity;
  // For 'x10' (money) items: the real BOND credited. For every other rarity
  // this is purely a flavor/display number (shown nowhere financial) -- the
  // item itself is saved to wish_inventory, not converted to BOND. Always 0
  // for isCoupon items -- a coupon has no BOND value either.
  valueBond: number;
  // Relative weight only -- documents the same distribution the RPC uses;
  // the client never rolls its own random pick for this wheel.
  weight: number;
  // True only for the "Джекпот" item (one per gender, migration 0031): still
  // an 'x10'-rarity sector for display/weight purposes, but it no longer
  // credits BOND -- it grants one free intimate-roulette spin coupon,
  // banked in wish_inventory. The result modal (WishRouletteScreen) checks
  // this before assuming an 'x10' item means a money prize.
  isCoupon?: boolean;
}

// Server-enforced in spin_wish_roulette: 3 BOND (0047) and a 12 h per-user
// cooldown counted from the last spin (migration 0048).
export const WISH_ROULETTE_SPIN_COST_BOND = 3;
export const WISH_ROULETTE_COOLDOWN_HOURS = 12;

export const RARITY_ORDER: WishRarity[] = ['cheap', 'almostBreakeven', 'x1', 'x3', 'x10'];

// Blue metallic palette, cycled across the male wheel's 20 sectors.
export const MALE_WHEEL_COLORS = ['#0B3D91', '#1565C0', '#1E88E5', '#64B5F6', '#0D47A1', '#3949AB'];
// Crimson/burgundy glossy palette, cycled across the female wheel's 20
// sectors -- was a bright pink/magenta family (#E91E8C etc.), replaced to
// match the app's dark crimson female theme (see theme/colors.ts).
export const FEMALE_WHEEL_COLORS = ['#4A0E1F', '#C41E3A', '#8B1226', '#A31B32', '#6E1423', '#B3183A'];

export const MALE_WISH_ITEMS: WishRouletteItem[] = [
  { key: 'm_tea_coffee', titleKey: 'm_tea_coffee', emoji: '☕', rarity: 'cheap', valueBond: 1, weight: 8 },
  { key: 'm_treat', titleKey: 'm_treat', emoji: '🧁', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'm_hugs', titleKey: 'm_hugs', emoji: '🤗', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'm_massage_10', titleKey: 'm_massage_10', emoji: '🤲', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'm_walk', titleKey: 'm_walk', emoji: '🌲', rarity: 'cheap', valueBond: 3, weight: 8 },
  { key: 'm_movie', titleKey: 'm_movie', emoji: '🎬', rarity: 'almostBreakeven', valueBond: 6, weight: 6 },
  { key: 'm_favorite_dish', titleKey: 'm_favorite_dish', emoji: '🍽️', rarity: 'almostBreakeven', valueBond: 7, weight: 6 },
  { key: 'm_massage_20', titleKey: 'm_massage_20', emoji: '🤲', rarity: 'almostBreakeven', valueBond: 8, weight: 6 },
  { key: 'm_evening_together', titleKey: 'm_evening_together', emoji: '🌙', rarity: 'almostBreakeven', valueBond: 8, weight: 6 },
  { key: 'm_massage_30', titleKey: 'm_massage_30', emoji: '🤲', rarity: 'almostBreakeven', valueBond: 9, weight: 6 },
  { key: 'm_dinner_choice', titleKey: 'm_dinner_choice', emoji: '🍴', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'm_date', titleKey: 'm_date', emoji: '🥂', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'm_intimate_massage', titleKey: 'm_intimate_massage', emoji: '🧘', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'm_special_closeness', titleKey: 'm_special_closeness', emoji: '💞', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'm_intimate_evening', titleKey: 'm_intimate_evening', emoji: '❤️', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'm_his_pose', titleKey: 'm_his_pose', emoji: '🛏️', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'm_special_scenario', titleKey: 'm_special_scenario', emoji: '🎭', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'm_big_day', titleKey: 'm_big_day', emoji: '🎁', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'm_jackpot', titleKey: 'm_jackpot', emoji: '💎', rarity: 'x10', valueBond: 0, weight: 1, isCoupon: true },
  { key: 'm_grand_prize', titleKey: 'm_grand_prize', emoji: '👑', rarity: 'x10', valueBond: 15, weight: 1 },
];

export const FEMALE_WISH_ITEMS: WishRouletteItem[] = [
  { key: 'f_tea_coffee', titleKey: 'f_tea_coffee', emoji: '☕', rarity: 'cheap', valueBond: 1, weight: 8 },
  { key: 'f_chocolate', titleKey: 'f_chocolate', emoji: '🍫', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'f_compliments', titleKey: 'f_compliments', emoji: '💝', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'f_breakfast', titleKey: 'f_breakfast', emoji: '🥐', rarity: 'cheap', valueBond: 2, weight: 8 },
  { key: 'f_cafe', titleKey: 'f_cafe', emoji: '☕', rarity: 'cheap', valueBond: 3, weight: 8 },
  { key: 'f_foot_massage', titleKey: 'f_foot_massage', emoji: '🦶', rarity: 'almostBreakeven', valueBond: 6, weight: 6 },
  { key: 'f_movie', titleKey: 'f_movie', emoji: '🎬', rarity: 'almostBreakeven', valueBond: 7, weight: 6 },
  { key: 'f_favorite_dish', titleKey: 'f_favorite_dish', emoji: '🍽️', rarity: 'almostBreakeven', valueBond: 8, weight: 6 },
  { key: 'f_flowers', titleKey: 'f_flowers', emoji: '💐', rarity: 'almostBreakeven', valueBond: 8, weight: 6 },
  { key: 'f_massage_20', titleKey: 'f_massage_20', emoji: '🌸', rarity: 'almostBreakeven', valueBond: 9, weight: 6 },
  { key: 'f_massage_30', titleKey: 'f_massage_30', emoji: '🖤', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'f_dinner_choice', titleKey: 'f_dinner_choice', emoji: '🍴', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'f_intimate_massage', titleKey: 'f_intimate_massage', emoji: '🪶', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'f_special_closeness', titleKey: 'f_special_closeness', emoji: '💕', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'f_date', titleKey: 'f_date', emoji: '💞', rarity: 'x1', valueBond: 10, weight: 4 },
  { key: 'f_intimate_evening', titleKey: 'f_intimate_evening', emoji: '👙', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'f_her_pose', titleKey: 'f_her_pose', emoji: '👠', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'f_big_day', titleKey: 'f_big_day', emoji: '📅', rarity: 'x3', valueBond: 30, weight: 2 },
  { key: 'f_jackpot', titleKey: 'f_jackpot', emoji: '👑', rarity: 'x10', valueBond: 0, weight: 1, isCoupon: true },
  { key: 'f_shopping', titleKey: 'f_shopping', emoji: '🛍️', rarity: 'x10', valueBond: 15, weight: 1 },
];

export const wishItemsFor = (gender: 'male' | 'female'): WishRouletteItem[] =>
  gender === 'male' ? MALE_WISH_ITEMS : FEMALE_WISH_ITEMS;

export const wheelColorsFor = (gender: 'male' | 'female'): string[] =>
  gender === 'male' ? MALE_WHEEL_COLORS : FEMALE_WHEEL_COLORS;
