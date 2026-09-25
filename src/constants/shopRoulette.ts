// Shop Roulette -- female-only 16-sector wheel (assets/roulette/shop-roulette.png,
// used as-is, never redrawn). Order below is index-for-index the same as the
// PNG's sectors, clockwise starting at 12 o'clock (index 0's center sits at
// SEGMENT_ANGLE/2 clockwise from the top, same convention as
// IntimateRouletteScreen/WishRouletteScreen) -- verified against the image by
// checking that opposite pairs land opposite each other (handbag/top vs
// cream/bottom, perfume/right vs candle/left).
//
// The server (spin_shop_roulette, migration 0032) is the sole authority on
// the outcome -- it picks the weighted winner and returns its item_key; this
// file only knows how to *display* whatever key comes back (title + which
// wheel index to spin the pointer to). Kept in sync BY HAND with the pool
// hardcoded inside spin_shop_roulette, exactly like wishRouletteConfig.ts.
//
// Every sector is a wish (never BOND) -- see migration 0032's header.

export interface ShopRouletteItem {
  key: string;
  // Translation key suffix -> shopRoulette.item_<titleKey>
  titleKey: string;
  // Equal weight for every sector -- no rarity tiers on this wheel.
  weight: number;
}

export const SHOP_ROULETTE_SPIN_COST_BOND = 10;

export const SHOP_ROULETTE_ITEMS: ShopRouletteItem[] = [
  { key: 'shop_handbag', titleKey: 'shop_handbag', weight: 1 },
  { key: 'shop_socks', titleKey: 'shop_socks', weight: 1 },
  { key: 'shop_necklace', titleKey: 'shop_necklace', weight: 1 },
  { key: 'shop_makeup', titleKey: 'shop_makeup', weight: 1 },
  { key: 'shop_perfume', titleKey: 'shop_perfume', weight: 1 },
  { key: 'shop_scarf', titleKey: 'shop_scarf', weight: 1 },
  { key: 'shop_robe', titleKey: 'shop_robe', weight: 1 },
  { key: 'shop_bow', titleKey: 'shop_bow', weight: 1 },
  { key: 'shop_cream', titleKey: 'shop_cream', weight: 1 },
  { key: 'shop_earrings', titleKey: 'shop_earrings', weight: 1 },
  { key: 'shop_bracelet', titleKey: 'shop_bracelet', weight: 1 },
  { key: 'shop_phone', titleKey: 'shop_phone', weight: 1 },
  { key: 'shop_candle', titleKey: 'shop_candle', weight: 1 },
  { key: 'shop_chocolate', titleKey: 'shop_chocolate', weight: 1 },
  { key: 'shop_mask', titleKey: 'shop_mask', weight: 1 },
  { key: 'shop_bag', titleKey: 'shop_bag', weight: 1 },
];
