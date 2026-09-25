// Store-readiness placeholders. Google Play / App Store review both expect a
// public, hosted page for each of these -- but none exist yet, so every
// value stays `null` on purpose rather than pointing at a fake/broken URL.
//
// TODO before submitting to App Store / Google Play: host real pages for
// each of these and fill in their URLs here (nothing else in the app needs
// to change -- SettingsScreen already reads from this file).
export const LEGAL_URLS: {
  privacyPolicy: string | null;
  terms: string | null;
  support: string | null;
  deleteAccount: string | null;
} = {
  privacyPolicy: null,
  terms: null,
  support: null,
  deleteAccount: null,
};
