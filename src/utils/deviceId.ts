import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'coupleup-device-id';

// A stable per-install identifier (not a hardware id) so device_tokens can
// have one row per installed app rather than per user across all their devices.
export const getDeviceId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(STORAGE_KEY, generated);
  return generated;
};
