import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as budgetService from '../services/supabase/budgetService';
import { subscribeToBudget } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
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
} from '../types/database';

const currentMonthIso = (): string => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

interface BudgetValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  shoppingItems: DbShoppingItem[];
  addShoppingItem: (input: { title: string; quantity: number; priceUsd?: number; payerMode: PayerMode; payerUserId?: string }) => Promise<void>;
  setShoppingItemPurchased: (id: string, purchased: boolean) => Promise<void>;
  budgets: DbBudget[];
  setBudget: (category: BudgetCategory, plannedUsd: number) => Promise<void>;
  expenses: DbExpense[];
  addExpense: (input: { title: string; amountUsd: number; category: BudgetCategory; paidBy: string; expenseDate: string; note?: string }) => Promise<void>;
  savingsGoals: DbSavingsGoal[];
  addSavingsGoal: (title: string, targetUsd: number) => Promise<void>;
  savingsContributions: DbSavingsContribution[];
  addSavingsContribution: (goalId: string, amountUsd: number) => Promise<void>;
  purchaseRequests: DbPurchaseRequest[];
  addPurchaseRequest: (input: { title: string; priceUsd: number; rateSnapshot: number; note?: string }) => Promise<void>;
  respondPurchaseRequest: (id: string, status: PurchaseRequestStatus) => Promise<void>;
  // Negotiation (migration 0020) -- only the request's recipient may
  // propose a counter price; only the original requester may accept/decline
  // it (both enforced server-side, this is just the client-side surface).
  purchaseRequestOffers: DbPurchaseRequestOffer[];
  proposeCounterOffer: (requestId: string, priceUsd: number, note?: string) => Promise<void>;
  respondCounterOffer: (offerId: string, accept: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const BudgetContext = createContext<BudgetValue | undefined>(undefined);

export const BudgetProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shoppingItems, setShoppingItems] = useState<DbShoppingItem[]>([]);
  const [budgets, setBudgets] = useState<DbBudget[]>([]);
  const [expenses, setExpenses] = useState<DbExpense[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<DbSavingsGoal[]>([]);
  const [savingsContributions, setSavingsContributions] = useState<DbSavingsContribution[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<DbPurchaseRequest[]>([]);
  const [purchaseRequestOffers, setPurchaseRequestOffers] = useState<DbPurchaseRequestOffer[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setShoppingItems([]);
      setBudgets([]);
      setExpenses([]);
      setSavingsGoals([]);
      setSavingsContributions([]);
      setPurchaseRequests([]);
      setPurchaseRequestOffers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [si, b, ex, sg, sc, pr, po] = await Promise.all([
        budgetService.listShoppingItems(coupleId),
        budgetService.listBudgets(coupleId, currentMonthIso()),
        budgetService.listExpenses(coupleId),
        budgetService.listSavingsGoals(coupleId),
        budgetService.listSavingsContributions(coupleId),
        budgetService.listPurchaseRequests(coupleId),
        budgetService.listPurchaseRequestOffers(coupleId),
      ]);
      setShoppingItems(si);
      setBudgets(b);
      setExpenses(ex);
      setSavingsGoals(sg);
      setSavingsContributions(sc);
      setPurchaseRequests(pr);
      setPurchaseRequestOffers(po);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToBudget(coupleId, {
      onShoppingItemsChange: refresh,
      onBudgetsChange: refresh,
      onExpensesChange: refresh,
      onSavingsGoalsChange: refresh,
      onSavingsContributionsChange: refresh,
      onPurchaseRequestsChange: refresh,
      onPurchaseRequestOffersChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<BudgetValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      shoppingItems,
      addShoppingItem: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await budgetService.addShoppingItem({ coupleId, addedBy: userId, ...input });
          setShoppingItems((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      setShoppingItemPurchased: async (id, purchased) => {
        setError(null);
        try {
          const row = await budgetService.setShoppingItemPurchased(id, purchased);
          setShoppingItems((prev) => prev.map((i) => (i.id === id ? row : i)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      budgets,
      setBudget: async (category, plannedUsd) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await budgetService.setBudget({ coupleId, createdBy: userId, category, month: currentMonthIso(), plannedUsd });
          setBudgets((prev) => [row, ...prev.filter((b) => b.id !== row.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      expenses,
      addExpense: async (input) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await budgetService.addExpense({ coupleId, createdBy: userId, ...input });
          setExpenses((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      savingsGoals,
      addSavingsGoal: async (title, targetUsd) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await budgetService.addSavingsGoal({ coupleId, createdBy: userId, title, targetUsd });
          setSavingsGoals((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      savingsContributions,
      addSavingsContribution: async (goalId, amountUsd) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          const row = await budgetService.addSavingsContribution({ goalId, coupleId, userId, amountUsd });
          setSavingsContributions((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      purchaseRequests,
      addPurchaseRequest: async (input) => {
        if (!coupleId || !userId || !sync.partner) return;
        setError(null);
        try {
          const row = await budgetService.addPurchaseRequest({ coupleId, requestedBy: userId, recipientId: sync.partner.id, ...input });
          setPurchaseRequests((prev) => [row, ...prev]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      respondPurchaseRequest: async (id, status) => {
        setError(null);
        try {
          const row = await budgetService.respondPurchaseRequest(id, status);
          setPurchaseRequests((prev) => prev.map((p) => (p.id === id ? row : p)));
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      purchaseRequestOffers,
      proposeCounterOffer: async (requestId, priceUsd, note) => {
        setError(null);
        try {
          const offer = await budgetService.proposeCounterOffer({ requestId, priceUsd, note });
          setPurchaseRequestOffers((prev) => [offer, ...prev.filter((o) => o.id !== offer.id)]);
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      respondCounterOffer: async (offerId, accept) => {
        setError(null);
        try {
          const offer = await budgetService.respondCounterOffer(offerId, accept);
          setPurchaseRequestOffers((prev) => prev.map((o) => (o.id === offerId ? offer : o)));
          if (accept) await refresh();
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [
      loading,
      error,
      shoppingItems,
      budgets,
      expenses,
      savingsGoals,
      savingsContributions,
      purchaseRequests,
      purchaseRequestOffers,
      refresh,
      coupleId,
      userId,
      sync.partner,
    ],
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
};

export const useBudget = (): BudgetValue => {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
};
