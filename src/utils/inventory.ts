import type { TranslationKey } from '../localization/useTranslation';

// wish_inventory item_key of an intimate-roulette spin coupon (migration 0031).
export const COUPON_ITEM_KEY = 'intimate_spin_coupon';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// Resolves an inventory row's title from whichever wheel actually won it --
// nothing is renamed or duplicated, this just picks the right existing
// translation namespace for the item_key already stored on the row.
export const resolveItemTitle = (itemKey: string, t: Translate): string => {
  if (itemKey === COUPON_ITEM_KEY) return t('winnings.couponItemLabel');
  if (itemKey.startsWith('shop_')) return t(`shopRoulette.item_${itemKey}` as TranslationKey);
  return t(`wishRoulette.item_${itemKey}` as TranslationKey);
};
