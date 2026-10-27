import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as questsService from '../services/supabase/questsService';
import { subscribeToQuests } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbQuestBonusClaim, DbQuestCustomItem, DbQuestHiddenItem, DbQuestProgress, QuestPeriod } from '../types/database';

interface QuestsValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  progress: DbQuestProgress[];
  bonusClaims: DbQuestBonusClaim[];
  customItems: DbQuestCustomItem[];
  hiddenItems: DbQuestHiddenItem[];
  // 'sent' = new request for the partner, 'duplicate' = already submitted or
  // done (server returned false), 'error' = failed -- `message` carries the
  // exact reason so the screen can show it next to the item.
  completeItem: (
    period: QuestPeriod,
    periodKey: string,
    itemKey: string,
    title: string,
    points: number,
  ) => Promise<{ status: 'sent' | 'duplicate' | 'error'; message?: string }>;
  claimBonus: (period: QuestPeriod, periodKey: string, milestone: number, bonusPoints: number, title: string) => Promise<boolean>;
  addCustomItem: (period: QuestPeriod, periodKey: string, title: string, points: number) => Promise<boolean>;
  // Hides a standard item (for good, not just this period) and puts a
  // custom item of the SAME point value in its place -- the free slot it
  // vacated, not a new paid extra. Title is user-chosen; points are locked
  // to the replaced item's own value so the reward still matches its tier.
  replaceStandardItem: (
    period: QuestPeriod,
    periodKey: string,
    standardItemKey: string,
    points: number,
    replacementTitle: string,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const QuestsContext = createContext<QuestsValue | undefined>(undefined);

export const QuestsProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DbQuestProgress[]>([]);
  const [bonusClaims, setBonusClaims] = useState<DbQuestBonusClaim[]>([]);
  const [customItems, setCustomItems] = useState<DbQuestCustomItem[]>([]);
  const [hiddenItems, setHiddenItems] = useState<DbQuestHiddenItem[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId) {
      setProgress([]);
      setBonusClaims([]);
      setCustomItems([]);
      setHiddenItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, b, c, h] = await Promise.all([
        questsService.listQuestProgress(coupleId),
        questsService.listQuestBonusClaims(coupleId),
        questsService.listQuestCustomItems(coupleId),
        questsService.listQuestHiddenItems(coupleId),
      ]);
      setProgress(p);
      setBonusClaims(b);
      setCustomItems(c);
      setHiddenItems(h);
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
    return subscribeToQuests(coupleId, {
      onProgressChange: refresh,
      onBonusClaimsChange: refresh,
      onCustomItemsChange: refresh,
      onHiddenItemsChange: refresh,
    });
  }, [coupleId, refresh]);

  const value = useMemo<QuestsValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      progress,
      bonusClaims,
      customItems,
      hiddenItems,
      completeItem: async (period, periodKey, itemKey, title, points) => {
        if (!coupleId || !userId) {
          return { status: 'error', message: !userId ? 'NOT_SIGNED_IN' : 'NO_COUPLE' };
        }
        setError(null);
        try {
          const ok = await questsService.completeQuestItem({ coupleId, period, periodKey, itemKey, title, points });
          await refresh();
          return { status: ok ? 'sent' : 'duplicate' };
        } catch (e) {
          const err = toServiceError(e);
          const friendly = friendlyMessage(err);
          setError(friendly);
          return { status: 'error', message: friendly === err.message ? friendly : `${friendly} (${err.message})` };
        }
      },
      claimBonus: async (period, periodKey, milestone, bonusPoints, title) => {
        if (!coupleId) return false;
        setError(null);
        try {
          const ok = await questsService.claimQuestBonus({ coupleId, period, periodKey, milestone, bonusPoints, title });
          if (ok) await refresh();
          return ok;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      addCustomItem: async (period, periodKey, title, points) => {
        if (!coupleId || !userId) return false;
        setError(null);
        try {
          const itemKey = `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          await questsService.addQuestCustomItem({ coupleId, period, periodKey, itemKey, title, points, createdBy: userId });
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      replaceStandardItem: async (period, periodKey, standardItemKey, points, replacementTitle) => {
        if (!coupleId || !userId) return false;
        setError(null);
        try {
          await questsService.hideQuestItem({ coupleId, userId, period, itemKey: standardItemKey });
          const itemKey = `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          await questsService.addQuestCustomItem({
            coupleId,
            period,
            periodKey,
            itemKey,
            title: replacementTitle,
            points,
            createdBy: userId,
            replacesItemKey: standardItemKey,
          });
          await refresh();
          return true;
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
          return false;
        }
      },
      refresh,
    }),
    [loading, error, progress, bonusClaims, customItems, hiddenItems, coupleId, userId, refresh],
  );

  return <QuestsContext.Provider value={value}>{children}</QuestsContext.Provider>;
};

export const useQuests = (): QuestsValue => {
  const ctx = useContext(QuestsContext);
  if (!ctx) throw new Error('useQuests must be used within QuestsProvider');
  return ctx;
};
