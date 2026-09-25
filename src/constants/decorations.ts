import { DecorationId } from '../types';

export interface DecorationStyle {
  id: DecorationId;
  title: string;
  description: string;
  price: string | null; // null = always free
  badgeLabel: string | null;
  cardBorderWidth: number;
  cardBorderStyle: 'solid' | 'dashed' | 'dotted';
  cardBorderColor: string | null; // null = use theme border/primary
  avatarRingWidth: number;
  avatarRingStyle: 'solid' | 'dashed' | 'dotted';
  avatarRingColor: string | null; // null = use theme primary
}

// Purely CSS/View-based cosmetics -- no new PNGs, no emoji as the primary asset.
export const DECORATIONS: Record<DecorationId, DecorationStyle> = {
  classic: {
    id: 'classic',
    title: 'Classic',
    description: 'Стандартное оформление профиля пары',
    price: null,
    badgeLabel: null,
    cardBorderWidth: 1,
    cardBorderStyle: 'solid',
    cardBorderColor: null,
    avatarRingWidth: 2,
    avatarRingStyle: 'solid',
    avatarRingColor: null,
  },
  hearts: {
    id: 'hearts',
    title: 'Hearts',
    description: 'Более заметная рамка и акцент в цвет темы',
    price: '$0.99',
    badgeLabel: 'Hearts',
    cardBorderWidth: 2,
    cardBorderStyle: 'solid',
    cardBorderColor: null,
    avatarRingWidth: 3,
    avatarRingStyle: 'solid',
    avatarRingColor: null,
  },
  stars: {
    id: 'stars',
    title: 'Stars',
    description: 'Пунктирная рамка карточки и аватара',
    price: '$0.99',
    badgeLabel: 'Stars',
    cardBorderWidth: 2,
    cardBorderStyle: 'dashed',
    cardBorderColor: null,
    avatarRingWidth: 3,
    avatarRingStyle: 'dotted',
    avatarRingColor: null,
  },
  minimal: {
    id: 'minimal',
    title: 'Minimal',
    description: 'Максимально чистый, почти без рамок',
    price: null,
    badgeLabel: null,
    cardBorderWidth: 1,
    cardBorderStyle: 'solid',
    cardBorderColor: null,
    avatarRingWidth: 1,
    avatarRingStyle: 'solid',
    avatarRingColor: null,
  },
  anniversary: {
    id: 'anniversary',
    title: 'Anniversary',
    description: 'Золотой акцент и бейдж для особого случая',
    price: '$1.99',
    badgeLabel: 'Годовщина',
    cardBorderWidth: 3,
    cardBorderStyle: 'solid',
    cardBorderColor: '#D4AF37',
    avatarRingWidth: 3,
    avatarRingStyle: 'solid',
    avatarRingColor: '#D4AF37',
  },
};

export const DECORATION_IDS = Object.keys(DECORATIONS) as DecorationId[];
