// Premium dark-navy accent palette for the MALE account's Home screen and
// bottom tab bar ONLY (confirmed with the user). This is deliberately a
// separate, narrowly-scoped palette -- NOT a change to maleTheme in
// theme/colors.ts, which stays the shared light theme used everywhere else
// in the app (Settings, Rewards, AllSections, etc., for both roles). Every
// place that reads this checks `role === 'male'` itself and keeps the
// original `colors.*` values otherwise, so the female theme and every other
// screen are visually untouched.
export const maleHomeDark = {
  cardBg: '#101B33',
  cardBgAlt: '#17264A',
  border: 'rgba(140, 180, 255, 0.32)',
  textPrimary: '#F4F8FF',
  textSecondary: '#9FB4DA',
  accent: '#5FA8FF',
  tabBarBg: '#0A1226',
  tabBarBorder: 'rgba(140, 180, 255, 0.22)',
} as const;
