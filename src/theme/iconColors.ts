import { Role } from '../types';

// Dedicated tint colors for the flat icon system (see components/common/IconImage.tsx)
// -- deliberately separate from theme/colors.ts's card/background palette
// (which stays dark navy/crimson, unchanged). Icons: blue family for male,
// pink family for female, same shape either way, only this color differs.
export interface IconColors {
  primary: string;
  secondary: string;
}

export const iconColors: Record<Role, IconColors> = {
  male: {
    // Unified with theme/colors.ts's `primary` -- BOND balance, icons,
    // active buttons, highlighted numbers and active nav all share this one
    // accent now. `secondary` stays a muted/lighter shade, used only for
    // the inactive tab-bar state (an intentional, separate distinction).
    primary: '#2F9EF4',
    secondary: '#5FA8FF',
  },
  female: {
    primary: '#F45A93',
    secondary: '#F5A8C4',
  },
};

export const getIconColor = (role: Role): string => iconColors[role].primary;
