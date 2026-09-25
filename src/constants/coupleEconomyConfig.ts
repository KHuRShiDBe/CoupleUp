// The one file to open for "the economy". Per-quest pricing, counts, and
// bonus milestones already live in questEconomy.ts (re-exported below so
// this file is a complete single entry point) -- the only genuinely NEW
// knob added here is the agreement failure penalty.

export * from './questEconomy';

// Agreement (couple_offers) penalty when the assignee misses the deadline:
// penalty = agreedPrice * FAILURE_PENALTY_MULTIPLIER. Charged only after
// full mutual agreement (an accepted offer/counter) -- a plain pending
// request never creates a penalty. See fail_agreement_penalty in
// supabase/migrations/0023_agreements.sql.
export const FAILURE_PENALTY_MULTIPLIER = 2;
