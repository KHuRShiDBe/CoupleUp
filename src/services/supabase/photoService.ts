import * as FileSystem from 'expo-file-system/legacy';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hand-written base64 -> ArrayBuffer decoder so we don't need an extra
// dependency (RN/Hermes has no built-in atob to lean on reliably) --
// expo-file-system already gives us the photo as a base64 string.
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = BASE64_CHARS.indexOf(clean[i]);
    const e2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const e3 = BASE64_CHARS.indexOf(clean[i + 2]);
    const e4 = BASE64_CHARS.indexOf(clean[i + 3]);

    const c1 = (e1 << 2) | (e2 >> 4);
    if (byteIndex < byteLength) bytes[byteIndex++] = c1;
    if (e3 >= 0) {
      const c2 = ((e2 & 15) << 4) | (e3 >> 2);
      if (byteIndex < byteLength) bytes[byteIndex++] = c2;
    }
    if (e4 >= 0) {
      const c3 = ((e3 & 3) << 6) | e4;
      if (byteIndex < byteLength) bytes[byteIndex++] = c3;
    }
  }
  return bytes.buffer;
};

// Uploads to profile-photos/<userId>/photo.jpg (always the same path, so a
// re-upload just replaces the old one -- see migration 0023's storage RLS,
// which restricts writes to each user's own folder). Returns the public URL.
export const uploadProfilePhoto = async (userId: string, localUri: string): Promise<string> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const buffer = base64ToArrayBuffer(base64);
  const path = `${userId}/photo.jpg`;

  const { error } = await supabase.storage.from('profile-photos').upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new ServiceError(error.message);

  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  // Cache-bust so the new photo shows immediately everywhere instead of a
  // stale CDN-cached copy at the same URL.
  return `${data.publicUrl}?t=${Date.now()}`;
};
