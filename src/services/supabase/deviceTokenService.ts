import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbDeviceTokenPlatform } from '../../types/database';

// One row per (user, device) -- re-registering the same device just refreshes
// the token and `updated_at` instead of creating a duplicate.
export const upsertDeviceToken = async (input: {
  userId: string;
  expoPushToken: string;
  platform: DbDeviceTokenPlatform;
  deviceId: string;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: input.userId,
      expo_push_token: input.expoPushToken,
      platform: input.platform,
      device_id: input.deviceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' },
  );
  if (error) throw new ServiceError(error.message);
};

export const deleteDeviceToken = async (userId: string, deviceId: string): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('device_tokens').delete().eq('user_id', userId).eq('device_id', deviceId);
  if (error) throw new ServiceError(error.message);
};
