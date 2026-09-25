import { useAppStore } from '../store/AppContext';
import { getTheme } from './colors';
import { PREMIUM_THEMES } from './premiumThemes';
import { Role } from '../types';

// `role` always stays tied to the free blue/pink base (it also drives which
// gendered avatar/icon assets load). A purchased+applied premium theme only
// swaps the color palette on top -- avatars and icons are unaffected.
export const useTheme = () => {
  const { selectedRole, selectedPremiumTheme } = useAppStore();
  const role: Role = selectedRole ?? 'male';
  const colors = selectedPremiumTheme ? PREMIUM_THEMES[selectedPremiumTheme].colors : getTheme(role);
  return { colors, role };
};
