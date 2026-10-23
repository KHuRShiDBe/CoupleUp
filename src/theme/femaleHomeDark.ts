// Female counterpart to maleHomeDark.ts -- currently just the one value
// icon-circle backdrops need: a shade *lighter* than the female card color
// (theme/colors.ts's femaleTheme.card, #2E0E18) so they read as a soft
// dark-cherry/burgundy tint instead of femaleTheme.background (#1A0710,
// near-black). Shared by Home, the bottom tab bar, and Notifications so
// every icon circle in the app uses the same tone.
export const femaleHomeDark = {
  cardBgAlt: '#3D1523',
} as const;
