// Supabase Edge Function: delete-account
//
// Account deletion needs privileges no client can safely hold: only Supabase
// Auth's admin API (`auth.admin.deleteUser`) can remove an `auth.users` row,
// and that API requires the `service_role` key -- which must never ship
// inside the Expo app. This function is the only place that key is used, and
// it is read from this function's own server-side environment (auto-provided
// by Supabase), never hardcoded and never sent to the client.
//
// The client calls this via `supabase.functions.invoke('delete-account')`,
// which forwards the caller's own session token in the Authorization header.
// That token is what identifies *whose* account gets deleted -- there is no
// way to pass a different user id and delete someone else's account.
//
// Deploy with the Supabase CLI (not EAS, not Git):
//   supabase functions deploy delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('missing Authorization header', { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    // Verify the caller's identity with the anon key + their own token --
    // never trust a user id supplied in the request body.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser(token);
    if (userError || !user) return new Response('invalid session', { status: 401 });

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Mirror leave_couple()'s cleanup so nothing is left pending on a
    // partner who's about to disappear, then remove the couple membership
    // and kill the invite code so nobody (returning partner or a stranger)
    // can join this now-abandoned-by-one-side couple with the old code.
    // (Shared history/points/tasks/goals/habits/etc are intentionally left
    // in place for the remaining partner -- migrations 0004 and 0014 make
    // every author/creator/user reference column nullable-on-delete so they
    // survive this safely, across every table added in every package.)
    const { data: membership } = await admin
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership?.couple_id) {
      await admin
        .from('reward_requests')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('couple_id', membership.couple_id)
        .eq('status', 'pending');
      await admin
        .from('penalties')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('couple_id', membership.couple_id)
        .eq('status', 'pending');
      await admin.from('couple_members').delete().eq('user_id', user.id);
      await admin
        .from('couples')
        .update({ code_expires_at: new Date().toISOString() })
        .eq('id', membership.couple_id);
    }

    // device_tokens and notifications cascade-delete automatically (FKs to
    // profiles.id are `on delete cascade`). Deleting the auth user cascades
    // to the profiles row too, which triggers those.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return new Response(`delete failed: ${deleteError.message}`, { status: 500 });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(`error: ${String(err)}`, { status: 500 });
  }
});
