-- verify_0019_to_0025.sql
-- Run after all_pending_migrations_0019_to_0025.sql. Every row should show ok = true.

with expected_tables(name) as (
  values
    ('daily_action_completions'), ('daily_progress'),
    ('purchase_request_offers'),
    ('quest_progress'), ('quest_custom_items'), ('quest_bonus_claims'),
    ('couple_offers'), ('couple_offer_counters'),
    ('intimate_roulette_consent'), ('intimate_roulette_settings'), ('intimate_roulette_results'),
    ('wish_roulette_results')
),
expected_functions(name) as (
  values
    ('complete_daily_action'), ('claim_daily_bonus'), ('spin_daily_reward_wheel'),
    ('propose_purchase_counter_offer'), ('respond_purchase_counter_offer'),
    ('complete_quest_item'), ('claim_quest_bonus'),
    ('respond_couple_offer'), ('propose_couple_offer_counter'), ('respond_couple_offer_counter'),
    ('complete_agreement'), ('fail_agreement_penalty'), ('request_cancel_agreement'), ('respond_cancel_agreement'),
    ('spin_wish_roulette')
),
expected_columns(table_name, column_name) as (
  values
    ('couple_offers', 'deadline'), ('couple_offers', 'assignee_id'), ('couple_offers', 'cancel_requested_by'),
    ('profiles', 'photo_url')
)
select 'table' as object_type, name as object_name,
       exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = expected_tables.name) as ok
from expected_tables
union all
select 'function', name,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = expected_functions.name)
from expected_functions
union all
select 'column', table_name || '.' || column_name,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = expected_columns.table_name and column_name = expected_columns.column_name)
from expected_columns
union all
select 'storage_bucket', 'profile-photos',
       exists (select 1 from storage.buckets where id = 'profile-photos')
union all
select 'realtime_table', name,
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = expected_tables.name)
from expected_tables
order by object_type, object_name;
