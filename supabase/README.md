# CoupleUp Supabase setup

1. Create a project at https://supabase.com (free tier is enough for development).
2. Open the SQL Editor in the Supabase dashboard and run the migrations **in
   order, each as its own run**:
   - `migrations/0001_init.sql` -- creates all tables, enables Row Level
     Security, adds the policies, the RPC functions, and turns on realtime.
   - `migrations/0002_pairing_ledger_security.sql` -- renames `users` to
     `profiles`, adds the `language` column, adds a 24h expiry to invite
     codes, turns `actions` into the single points ledger (a trigger keeps
     `couples.points` in sync from it), adds server-side bounds on every
     points/cost column, and blocks a user from confirming their own reward
     request or penalty.
   - `migrations/0003_notifications.sql` -- adds `device_tokens` (one row per
     signed-in device) and `notifications` (a server-side event log, written
     only by triggers -- clients can't insert into it), adds
     `notification_preferences` / `push_enabled` / `quiet_hours_*` to
     `profiles`, and wires up triggers on actions/tasks/reward_requests/
     penalties that create a notification for the partner on 8 event types.
   - `migrations/0004_security_privacy.sql` -- **security fix**: removes five
     RLS policies (`couples`/`tasks`/`goals`/`reward_requests`/`penalties`
     update policies from 0001/0002) that had no `WITH CHECK`, which let any
     signed-in couple member write those tables' columns directly and bypass
     the ledger/RPC logic entirely (see the migration's own comments for the
     full explanation); fixes a cascade bug where deleting the couple
     creator's account would have deleted the whole couple's shared data out
     from under the other partner; adds `leave_couple()`, `blocked_users`,
     and a write-only `reports` table; and teaches `join_couple_by_code` to
     refuse pairing when either side has blocked the other.

   All four files are additive and safe to re-run (no `DROP TABLE`,
   everything uses `IF EXISTS` / `IF NOT EXISTS` / `OR REPLACE`). If you
   already ran earlier ones from a previous setup, just run the new one(s)
   on top, in order.
3. In Project Settings -> API, copy the "Project URL" and the "anon public" key
   (never the "service_role" key).
4. In the app folder, copy `.env.example` to `.env` and fill in those two
   values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
5. Restart the Expo dev server (`npx expo start`) so the new env vars and
   dependencies are picked up.
6. Open the app -> Profile -> Settings -> "Аккаунт и синхронизация" to sign up,
   create or join a couple code, and see the pair sync in real time. Try it
   on two devices/simulators signed in as two different accounts to see
   actions, reward requests and penalties sync live.

Until steps 1-4 are done, `isSupabaseConfigured` (see `src/lib/supabase.ts`) is
`false` and the app runs entirely on its local/mock state -- nothing else
breaks.

## Push notifications (optional, on top of the above)

The app already registers each signed-in device's Expo push token and writes
in-app notification rows for both partners (see the 8 event types in
`migrations/0003_notifications.sql`) once steps 1-6 above are done -- no
extra setup needed for that part.

Actually **sending** a push (not just logging it) needs one more piece,
because the app itself must never hold your project's `service_role` key:
the `send-push` Edge Function, running server-side with its own key, reads
each new `notifications` row and forwards it to Expo's push API.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) on your
   machine (not run from inside this app -- it's a separate one-time tool).
2. From this project folder: `supabase login`, then `supabase link --project-ref YOUR-PROJECT-REF`.
3. Deploy the function: `supabase functions deploy send-push`
   (`supabase/functions/send-push/index.ts`). The CLI provisions
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for it automatically --
   you don't set those yourself.
4. In the Supabase Dashboard: **Database -> Webhooks -> Create a new webhook**
   - Table: `notifications`
   - Events: `Insert`
   - Type: `Supabase Edge Functions`
   - Edge Function: `send-push`
5. That's it -- from then on, every new `notifications` row triggers a push
   to every device token that user has registered, unless they've turned
   that category off, disabled push entirely, or it's inside their quiet
   hours (all checked inside the function before it calls Expo).

None of this requires EAS or Git -- the Edge Function is deployed with the
Supabase CLI only, and the app never needs a Supabase service key.

### Expo Go limitations for push

- **Android + Expo Go (SDK 53+): remote push does not work at all** --
  Expo's own limitation, not something this app can work around. A custom
  dev client (`expo-dev-client`, built with EAS or locally) is required to
  actually receive a push on Android. Local notifications (used by the
  `__DEV__`-only Notification Test screen in Settings) still work fine in
  Expo Go on both platforms.
- **Any platform, no EAS project id**: `getExpoPushTokenAsync` also needs an
  EAS project id (`app.json` -> `extra.eas.projectId`), which this project
  intentionally doesn't have yet (no EAS has been run). Until one exists,
  `registerForPushNotificationsAsync()` in `src/services/notifications/pushService.ts`
  degrades gracefully -- no token is registered, nothing crashes, and the
  in-app notification list still works via realtime regardless.

## Account deletion (needs its own Edge Function too)

Deleting a Supabase Auth user requires the admin API, which needs the
`service_role` key -- so like push, this needs a small server-side piece the
app itself never touches:

1. Same CLI setup as above (`supabase login` / `supabase link`, if not done already).
2. Deploy: `supabase functions deploy delete-account`
   (`supabase/functions/delete-account/index.ts`). Again, `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are provisioned automatically by the CLI.
3. No webhook needed this time -- the app calls it directly via
   `supabase.functions.invoke('delete-account')` when the user confirms
   deletion on the Delete Account screen. The function verifies the caller's
   own session token (nobody can delete another account), resolves any
   pending reward requests/penalties in their couple, removes them from
   `couple_members`, and finally deletes the `auth.users` row -- which
   cascades to their `profiles` row, `device_tokens` and `notifications`.
   Their couple and its shared history/points are left intact for the
   remaining partner (see migration 0004's comments for why that's safe).

Until this function is deployed, `accountService.requestAccountDeletion()`
will fail with a normal network/not-found error and the Delete Account
screen shows it as a regular error state -- nothing crashes.

## What's real vs. local-only after this setup

- **Cloud-backed** (once signed in + paired): the "Аккаунт и синхронизация"
  screen -- auth, couple pairing, live points/actions/reward-requests/penalties
  feed, realtime updates on both devices, editing name/avatar/email/password,
  signing out, leaving the couple, blocking/reporting a partner, and (via the
  Edge Function above) account deletion; plus the notifications system --
  the NotificationsScreen's cloud section, unread badge on Profile, in-app
  banners, and (once the send-push Edge Function is deployed) real push.
- **Still local-only**: Home/History/Rewards/Tasks/Profile and the rest of the
  app's main tabs continue to run on the local mock `AppContext`, independent
  of Supabase. Wiring those primary screens to prefer live Supabase data once
  you've confirmed the backend works end-to-end is the natural next step, not
  included in this pass to avoid touching working UI before there was a live
  project to test against.
