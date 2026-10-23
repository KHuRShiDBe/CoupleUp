import { Role } from '../types';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  background: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  success: string;
  danger: string;
  glow: string;
}

// Light pastel palettes -- app-wide background/card/text, not tied to the
// old dark wallpaper photos anymore (see ScreenBackground.tsx, which no
// longer renders them as the base background). `primary`/`primaryDark`/
// `secondary` keep their existing vivid accent hues (also used by the flat
// icon system, theme/iconColors.ts) -- only surface/border/text tokens
// moved to this light scheme.
export const maleTheme: ThemeColors = {
  // Clean and fresh blue -- no grey undertone, no green/cyan, not too dark,
  // not acidic.
  primary: '#2F9EF4',
  primaryDark: '#1C64D1',
  secondary: '#5FA8FF',
  background: '#BFE3FF',
  // Softer/lighter than the background, not white -- cards must read as
  // "on-theme blue", never as a neutral white surface.
  card: '#DDF1FF',
  border: '#A8D6F7',
  text: '#17324A',
  textSecondary: '#7488A3',
  textOnPrimary: '#FFFFFF',
  success: '#2FBE7C',
  danger: '#EB5757',
  glow: 'rgba(47, 128, 237, 0.25)',
};

// Soft pastel pink -- not the old bright "hot pink" (#EC5C8D family), and
// not the later deep-crimson dark-theme family either. `primary` stays a
// deeper rose/crimson accent (reads well on the light pink background and
// is still not neon/hot pink).
export const femaleTheme: ThemeColors = {
  // Clean and soft pink -- no muddy/maroon undertone, no hot pink, not
  // childish.
  primary: '#F45A93',
  primaryDark: '#8B1226',
  secondary: '#6E1423',
  background: '#FFD1E1',
  // Softer/lighter than the background, not white -- cards must read as
  // "on-theme pink", never as a neutral white surface.
  card: '#FFE4ED',
  border: '#F3B5CA',
  text: '#4A2230',
  textSecondary: '#A17A8E',
  textOnPrimary: '#FFFFFF',
  success: '#2FBE7C',
  danger: '#EB5757',
  glow: 'rgba(196, 30, 58, 0.20)',
};

export const getTheme = (role: Role | null): ThemeColors =>
  role === 'female' ? femaleTheme : maleTheme;
