import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ServiceError } from './errors';
import {
  BudgetCategory,
  DbBudget,
  DbExpense,
  DbPurchaseRequest,
  DbPurchaseRequestOffer,
  DbSavingsContribution,
  DbSavingsGoal,
  DbShoppingItem,
  PayerMode,
  PurchaseRequestStatus,
} from '../../types/database';

// ---- Shopping list -----------------------------------------------------

export const listShoppingItems = async (coupleId: string): Promise<DbShoppingItem[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('shopping_items').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbShoppingItem[]) ?? [];
};

export const addShoppingItem = async (input: {
  coupleId: string;
  addedBy: string;
  title: string;
  quantity: number;
  priceUsd?: number;
  payerMode: PayerMode;
  payerUserId?: string;
}): Promise<DbShoppingItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      couple_id: input.coupleId,
      added_by: input.addedBy,
      title: input.title,
      quantity: input.quantity,
      price_usd: input.priceUsd,
      payer_mode: input.payerMode,
      payer_user_id: input.payerUserId,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbShoppingItem;
};

export const setShoppingItemPurchased = async (id: string, purchased: boolean): Promise<DbShoppingItem> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.from('shopping_items').update({ purchased }).eq('id', id).select().single();
  if (error) throw new ServiceError(error.message);
  return data as DbShoppingItem;
};

// ---- Budgets --------------------------------------------------------------

export const listBudgets = async (coupleId: string, month: string): Promise<DbBudget[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('budgets').select('*').eq('couple_id', coupleId).eq('month', month);
  if (error) throw new ServiceError(error.message);
  return (data as DbBudget[]) ?? [];
};

export const setBudget = async (input: {
  coupleId: string;
  createdBy: string;
  category: BudgetCategory;
  month: string;
  plannedUsd: number;
}): Promise<DbBudget> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { couple_id: input.coupleId, created_by: input.createdBy, category: input.category, month: input.month, planned_usd: input.plannedUsd },
      { onConflict: 'couple_id,category,month' },
    )
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbBudget;
};

// ---- Expenses -----------------------------------------------------------

export const listExpenses = async (coupleId: string): Promise<DbExpense[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('expenses').select('*').eq('couple_id', coupleId).order('expense_date', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbExpense[]) ?? [];
};

export const addExpense = async (input: {
  coupleId: string;
  createdBy: string;
  title: string;
  amountUsd: number;
  category: BudgetCategory;
  paidBy: string;
  expenseDate: string;
  note?: string;
}): Promise<DbExpense> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      couple_id: input.coupleId,
      created_by: input.createdBy,
      title: input.title,
      amount_usd: input.amountUsd,
      category: input.category,
      paid_by: input.paidBy,
      expense_date: input.expenseDate,
      note: input.note,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbExpense;
};

// ---- Savings goals + contributions ------------------------------------

export const listSavingsGoals = async (coupleId: string): Promise<DbSavingsGoal[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('savings_goals').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbSavingsGoal[]) ?? [];
};

export const addSavingsGoal = async (input: { coupleId: string; createdBy: string; title: string; targetUsd: number }): Promise<DbSavingsGoal> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({ couple_id: input.coupleId, created_by: input.createdBy, title: input.title, target_usd: input.targetUsd })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbSavingsGoal;
};

export const listSavingsContributions = async (coupleId: string): Promise<DbSavingsContribution[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('savings_contributions').select('*').eq('couple_id', coupleId);
  if (error) throw new ServiceError(error.message);
  return (data as DbSavingsContribution[]) ?? [];
};

export const addSavingsContribution = async (input: { goalId: string; coupleId: string; userId: string; amountUsd: number }): Promise<DbSavingsContribution> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('savings_contributions')
    .insert({ goal_id: input.goalId, couple_id: input.coupleId, user_id: input.userId, amount_usd: input.amountUsd })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbSavingsContribution;
};

// ---- Purchase requests -----------------------------------------------

export const listPurchaseRequests = async (coupleId: string): Promise<DbPurchaseRequest[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('purchase_requests').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbPurchaseRequest[]) ?? [];
};

export const addPurchaseRequest = async (input: {
  coupleId: string;
  requestedBy: string;
  recipientId: string;
  title: string;
  priceUsd: number;
  rateSnapshot: number;
  note?: string;
}): Promise<DbPurchaseRequest> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase
    .from('purchase_requests')
    .insert({
      couple_id: input.coupleId,
      requested_by: input.requestedBy,
      recipient_id: input.recipientId,
      title: input.title,
      price_usd: input.priceUsd,
      rate_snapshot: input.rateSnapshot,
      note: input.note,
    })
    .select()
    .single();
  if (error) throw new ServiceError(error.message);
  return data as DbPurchaseRequest;
};

// Goes through respond_purchase_request (migration 0017) rather than a raw
// UPDATE: that RPC rejects self-approval, wrong-status transitions, and
// (since the raw client UPDATE policy was removed alongside it) can no
// longer have price/title/etc smuggled through the same "approve" call.
export const respondPurchaseRequest = async (id: string, status: PurchaseRequestStatus): Promise<DbPurchaseRequest> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_purchase_request', {
    p_request_id: id,
    p_approve: status === 'approved',
  });
  if (error) throw new ServiceError(error.message);
  return data as DbPurchaseRequest;
};

// ---- Purchase request counter-offers (migration 0020) ---------------------

export const listPurchaseRequestOffers = async (coupleId: string): Promise<DbPurchaseRequestOffer[]> => {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('purchase_request_offers')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data as DbPurchaseRequestOffer[]) ?? [];
};

// Only the recipient of the original request may propose a counter price --
// enforced server-side (NOT_RECIPIENT), this call just surfaces that error.
export const proposeCounterOffer = async (input: { requestId: string; priceUsd: number; note?: string }): Promise<DbPurchaseRequestOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('propose_purchase_counter_offer', {
    p_request_id: input.requestId,
    p_price_usd: input.priceUsd,
    p_note: input.note ?? null,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbPurchaseRequestOffer;
};

// Only the original requester may accept/decline -- accepting atomically
// re-prices and approves the underlying purchase_request server-side.
export const respondCounterOffer = async (offerId: string, accept: boolean): Promise<DbPurchaseRequestOffer> => {
  if (!isSupabaseConfigured) throw new ServiceError('Backend не настроен', 'NOT_CONFIGURED');
  const { data, error } = await supabase.rpc('respond_purchase_counter_offer', {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) throw new ServiceError(error.message);
  return data as DbPurchaseRequestOffer;
};
