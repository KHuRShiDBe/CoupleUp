import { ThemeColors } from './colors';
import { PremiumThemeId } from '../types';

export interface PremiumThemeMeta {
  id: PremiumThemeId;
  title: string;
  price: string;
  colors: ThemeColors;
}

// All cosmetic-only palettes. Kept light per the app's design language --
// none of these are dark-mode themes, just different accent colors.
export const PREMIUM_THEMES: Record<PremiumThemeId, PremiumThemeMeta> = {
  lavender: {
    id: 'lavender',
    title: 'Lavender',
    price: '$0.99',
    colors: {
      primary: '#9B6FD1',
      primaryDark: '#7C4FB8',
      secondary: '#C9A8ED',
      background: '#F6F2FC',
      card: '#FFFFFF',
      border: '#E9DFF7',
      text: '#2E2140',
      textSecondary: '#8A7A9E',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(155, 111, 209, 0.35)',
    },
  },
  sunset: {
    id: 'sunset',
    title: 'Sunset',
    price: '$0.99',
    colors: {
      primary: '#FF7A59',
      primaryDark: '#E85C3D',
      secondary: '#FFB199',
      background: '#FFF4EF',
      card: '#FFFFFF',
      border: '#FFE1D3',
      text: '#402A20',
      textSecondary: '#A6785E',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(255, 122, 89, 0.35)',
    },
  },
  ocean: {
    id: 'ocean',
    title: 'Ocean',
    price: '$1.99',
    colors: {
      primary: '#1E9FA8',
      primaryDark: '#157F86',
      secondary: '#6FD0D8',
      background: '#EFFBFC',
      card: '#FFFFFF',
      border: '#D3F0F2',
      text: '#163B3E',
      textSecondary: '#5E9095',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(30, 159, 168, 0.35)',
    },
  },
  'rose-gold': {
    id: 'rose-gold',
    title: 'Rose Gold',
    price: '$1.99',
    colors: {
      primary: '#C97A8B',
      primaryDark: '#A85D6E',
      secondary: '#E2A8A0',
      background: '#FDF3F1',
      card: '#FFFFFF',
      border: '#F3DCDA',
      text: '#4A2E30',
      textSecondary: '#A9807F',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(201, 122, 139, 0.35)',
    },
  },
  midnight: {
    id: 'midnight',
    title: 'Midnight',
    price: '$2.99',
    colors: {
      primary: '#3B4B8C',
      primaryDark: '#2C3A70',
      secondary: '#6E7DC4',
      background: '#F2F4FA',
      card: '#FFFFFF',
      border: '#DCE1F2',
      text: '#1B2340',
      textSecondary: '#6B7396',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(59, 75, 140, 0.35)',
    },
  },
  mint: {
    id: 'mint',
    title: 'Mint',
    price: '$0.99',
    colors: {
      primary: '#2FBE99',
      primaryDark: '#1F9E7D',
      secondary: '#7FE0C3',
      background: '#EFFBF6',
      card: '#FFFFFF',
      border: '#D2F0E4',
      text: '#163A30',
      textSecondary: '#5E9683',
      textOnPrimary: '#FFFFFF',
      success: '#2FBE7C',
      danger: '#EB5757',
      glow: 'rgba(47, 190, 153, 0.35)',
    },
  },
};

export const PREMIUM_THEME_IDS = Object.keys(PREMIUM_THEMES) as PremiumThemeId[];
