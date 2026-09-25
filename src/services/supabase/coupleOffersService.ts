import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import { DbCoupleOffer, DbCoupleOfferCounter } from '../../types/database';

export const listCoupleOffers = async (coupleId: string): Promise<DbCoupleOffer[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('couple_offers')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbCoupleOffer[]) ?? [];
};

export const listCoupleOfferCounters = async (coupleId: string): Promise<DbCoupleOfferCounter[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('couple_offer_counters')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbCoupleOfferCounter[]) ?? [];
};

export const createCoupleOffer = async (input: {
  coupleId: string;
  createdBy: string;
  title: string;
  pricePoints: number;
  deadlineIso?: string | null;
}): Promise<void> => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('couple_offers').insert({
    couple_id: input.coupleId,
    created_by: input.createdBy,
    title: input.title,
    price_points: input.pricePoints,
    deadline: input.deadlineIso ?? null,
  });
  if (error) throw new ServiceError(error.message);
};

// Only the partner who did NOT create the offer may accept/decline its
// original price (RPC: respond_couple_offer).
export const respondCoupleOffer = async (offerId: string, accept: boolean): Promise<DbCoupleOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_couple_offer', {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOffer;
};

// Only the partner who did NOT create the offer may propose a different price.
export const proposeCoupleOfferCounter = async (
  offerId: string,
  pricePoints: number,
  note?: string,
): Promise<DbCoupleOfferCounter> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('propose_couple_offer_counter', {
    p_offer_id: offerId,
    p_price_points: pricePoints,
    p_note: note ?? null,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOfferCounter;
};

// Only the original proposer of the parent offer may accept/decline a counter.
export const respondCoupleOfferCounter = async (counterId: string, accept: boolean): Promise<DbCoupleOfferCounter> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_couple_offer_counter', {
    p_counter_id: counterId,
    p_accept: accept,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOfferCounter;
};

// Only the assignee (whoever accepted, i.e. committed to perform it) may
// mark an agreement done -- pays price_points to them.
export const completeAgreement = async (offerId: string): Promise<DbCoupleOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('complete_agreement', { p_offer_id: offerId });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOffer;
};

// Either partner may call; the server re-validates the deadline has
// actually passed before charging -price*multiplier to the assignee.
export const failAgreementPenalty = async (offerId: string, multiplier: number): Promise<DbCoupleOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('fail_agreement_penalty', { p_offer_id: offerId, p_multiplier: multiplier });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOffer;
};

export const requestCancelAgreement = async (offerId: string): Promise<DbCoupleOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('request_cancel_agreement', { p_offer_id: offerId });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOffer;
};

// Only the party who did NOT request the cancel may respond to it.
export const respondCancelAgreement = async (offerId: string, accept: boolean): Promise<DbCoupleOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_cancel_agreement', { p_offer_id: offerId, p_accept: accept });
  if (error) throw new ServiceError(error.message);
  return data as DbCoupleOffer;
};
