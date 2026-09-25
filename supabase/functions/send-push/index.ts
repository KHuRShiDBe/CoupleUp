// Supabase Edge Function: send-push
//
// Triggered by a Database Webhook on `insert` into `public.notifications`
// (configured in the Supabase Dashboard -- see supabase/README.md). Looks up
// the recipient's push settings and device tokens, applies their
// notification-category preference and quiet hours, and forwards the message
// to the Expo Push API.
//
// SUPABASE_SERVICE_ROLE_KEY is read from this function's own server-side
// environment (auto-provided by Supabase for every Edge Function) -- it is
// never present in the Expo app bundle.
//
// Deploy with the Supabase CLI (not EAS, not Git):
//   supabase functions deploy send-push
// Then wire a Database Webhook: Dashboard -> Database -> Webhooks -> new
// webhook on table `notifications`, event `INSERT`, target this function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Maps a notification's event type to the Settings category the recipient
// may have turned off. Server-side check mirrors the client's own toggles
// (kept in sync by src/store/useProfileAutoSync.ts) so a stale/offline client
// can't cause an unwanted push.
const PREF_KEY_BY_TYPE: Record<string, string> = {
  action: 'actions',
  task: 'tasks',
  task_done: 'tasks',
  reward_request: 'rewardRequests',
  reward_response: 'rewardRequests',
  penalty: 'penalties',
  penalty_response: 'penalties',
  goal: 'goals',
};

// Deliberately simple: both hours are plain 0-23 values with no timezone
// attached (matches the "don't overbuild quiet hours" scope from the app's
// Settings screen). Wraps past midnight when start > end (e.g. 22 -> 8).
const isQuietHour = (startHour: number | null, endHour: number | null): boolean => {
  if (startHour == null || endHour == null || startHour === endHour) return false;
  const hour = new Date().getUTCHours();
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
};

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const notification = payload.record as {
      recipient_id: string;
      type: string;
      entity_id: string | null;
      title: string;
      body: string;
    } | null;
    if (!notification) return new Response('ignored: no record', { status: 200 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_enabled, notification_preferences, quiet_hours_start, quiet_hours_end')
      .eq('id', notification.recipient_id)
      .maybeSingle();

    if (!profile || !profile.push_enabled) {
      return new Response('skipped: push disabled', { status: 200 });
    }

    const prefKey = PREF_KEY_BY_TYPE[notification.type];
    if (prefKey && profile.notification_preferences?.[prefKey] === false) {
      return new Response('skipped: category disabled', { status: 200 });
    }

    if (isQuietHour(profile.quiet_hours_start, profile.quiet_hours_end)) {
      return new Response('skipped: quiet hours', { status: 200 });
    }

    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('expo_push_token')
      .eq('user_id', notification.recipient_id);

    if (!tokens || tokens.length === 0) {
      return new Response('skipped: no device tokens', { status: 200 });
    }

    // Payload security: only the generic type/entity-id/title/body already
    // stored on the notifications row is ever sent -- never the raw action,
    // task or reward text.
    const messages = tokens.map((row: { expo_push_token: string }) => ({
      to: row.expo_push_token,
      title: notification.title,
      body: notification.body,
      data: { type: notification.type, entityId: notification.entity_id },
      sound: 'default',
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await expoRes.json();

    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(`error: ${String(err)}`, { status: 500 });
  }
});
