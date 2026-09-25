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

export const maleTheme: ThemeColors = {
  primary: '#2F80ED',
  primaryDark: '#1C64D1',
  secondary: '#56CCF2',
  background: '#F5F9FF',
  card: '#FFFFFF',
  border: '#E3EEFB',
  text: '#1A2B3C',
  textSecondary: '#7488A3',
  textOnPrimary: '#FFFFFF',
  success: '#2FBE7C',
  danger: '#EB5757',
  glow: 'rgba(47, 128, 237, 0.35)',
};

export const femaleTheme: ThemeColors = {
  primary: '#EC5C8D',
  primaryDark: '#D43E71',
  secondary: '#FF9AB8',
  background: '#FFF6FA',
  card: '#FFFFFF',
  border: '#FBE3EE',
  text: '#3C2230',
  textSecondary: '#A17A8E',
  textOnPrimary: '#FFFFFF',
  success: '#2FBE7C',
  danger: '#EB5757',
  glow: 'rgba(236, 92, 141, 0.35)',
};

export const getTheme = (role: Role | null): ThemeColors =>
  role === 'female' ? femaleTheme : maleTheme;
