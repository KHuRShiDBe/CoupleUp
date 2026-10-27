import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useQuests } from '../../store/QuestsContext';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { QuestPeriod } from '../../types/database';
import {
  QuestDifficulty,
  QUEST_BASE_POINTS,
  QUEST_BONUS_MILESTONES_BY_PERIOD,
  QUEST_BONUS_PERIODS,
  nextCustomQuestPrice,
} from '../../constants/questEconomy';
import { getPeriodKey, getQuestsFor } from '../../constants/questSelection';

const PERIOD_ORDER: QuestPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface DisplayQuest {
  key: string;
  title: string;
  points: number;
  // Approved only (quest_progress row exists -- migration 0041 only creates
  // one on approval, never on the initial "Отметить" tap).
  completed: boolean;
  // A pending action_request exists for this exact item -- awaiting the
  // partner's ✓/✕, not yet counted anywhere.
  pending: boolean;
  difficulty?: QuestDifficulty;
  // Only standard (pool) items can be replaced -- custom ones (including
  // replacements themselves) have nothing left to swap out.
  isStandard: boolean;
}

export const RewardsScreen = () => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Rewards'>>();
  const auth = useAuth();
  const sync = useCoupleSync();
  const quests = useQuests();
  const [period, setPeriod] = useState<QuestPeriod>(route.params?.period ?? 'daily');
  const [addQuestOpen, setAddQuestOpen] = useState(false);
  const [customQuestTitle, setCustomQuestTitle] = useState('');
  const [replaceTarget, setReplaceTarget] = useState<DisplayQuest | null>(null);
  const [replaceTitle, setReplaceTitle] = useState('');

  const coupleId = sync.couple?.id ?? null;
  const myId = auth.session?.user?.id;
  const periodKey = getPeriodKey(period);

  const periodTabs = PERIOD_ORDER.map((p) => ({ key: p, label: t(`quests.tab${p.charAt(0).toUpperCase()}${p.slice(1)}` as TranslationKey) }));

  const allSystemQuests = useMemo(
    // Pool of MY OWN role: every item is worded to the person doing it.
    () => (coupleId ? getQuestsFor(period, periodKey, coupleId, role) : []),
    [coupleId, period, periodKey, role],
  );

  // Standard items I've replaced (see replaceStandardItem) stay hidden for
  // every future day/week/month/year, not just today -- period-scoped, not
  // period_key-scoped.
  const hiddenKeys = useMemo(
    () => new Set(quests.hiddenItems.filter((h) => h.user_id === myId && h.period === period).map((h) => h.item_key)),
    [quests.hiddenItems, myId, period],
  );
  const systemQuests = useMemo(() => allSystemQuests.filter((item) => !hiddenKeys.has(item.id)), [allSystemQuests, hiddenKeys]);

  const customQuestsForPeriod = useMemo(
    () => quests.customItems.filter((c) => c.period === period && c.period_key === periodKey),
    [quests.customItems, period, periodKey],
  );
  // A replacement fills the free slot its hidden standard item vacated --
  // only a genuine "extra" (replaces_item_key null) counts toward the paid
  // overflow price below.
  const replacementCustomItems = useMemo(() => customQuestsForPeriod.filter((c) => c.replaces_item_key), [customQuestsForPeriod]);
  const extraCustomItems = useMemo(() => customQuestsForPeriod.filter((c) => !c.replaces_item_key), [customQuestsForPeriod]);

  const isCompleted = (itemKey: string) =>
    quests.progress.some((p) => p.period === period && p.period_key === periodKey && p.item_key === itemKey);

  // Awaiting the partner's ✓/✕ -- a rejected request doesn't match (status
  // moved off 'pending'), so "Отметить" becomes available again right away.
  const isPending = (itemKey: string) =>
    sync.actionRequests.some(
      (ar) => ar.status === 'pending' && ar.period === period && ar.period_key === periodKey && ar.item_key === itemKey,
    );

  // Bonus claim (5/7/10) awaiting the partner's ✓/✕ -- only for requests
  // created under migration 0043. Since 0046 claim_quest_bonus pays at once
  // (the counted items were already partner-approved), so no new ones appear.
  const isBonusPending = (milestone: number) =>
    sync.actionRequests.some(
      (ar) =>
        ar.status === 'pending' &&
        ar.actor_user_id === myId &&
        ar.period === period &&
        ar.period_key === periodKey &&
        ar.bonus_milestone === milestone,
    );

  const displayQuests: DisplayQuest[] = useMemo(() => {
    // systemQuests already arrives sorted by tier (getQuestsFor) -- every
    // period is tiered now, no per-period branching needed.
    const fromSystem: DisplayQuest[] = systemQuests.map((item) => ({
      key: item.id,
      title: t(`quests.item_${item.titleKey}` as TranslationKey),
      points: QUEST_BASE_POINTS[period][item.difficulty],
      completed: isCompleted(item.id),
      pending: isPending(item.id),
      difficulty: item.difficulty,
      isStandard: true,
    }));
    const fromCustom: DisplayQuest[] = customQuestsForPeriod.map((c) => ({
      key: c.item_key,
      title: c.title,
      points: c.points,
      completed: isCompleted(c.item_key),
      pending: isPending(c.item_key),
      isStandard: false,
    }));
    return [...fromSystem, ...fromCustom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemQuests, customQuestsForPeriod, quests.progress, sync.actionRequests, period]);

  // Progress/milestones only ever apply to the 15 free slots for the current
  // period -- visible standard items plus whatever's replaced them. Genuine
  // paid extras (added via "+ Добавить своё" beyond the free 15) don't count
  // toward them, same as before. Real count, not a hardcoded total.
  const questTotal = systemQuests.length + replacementCustomItems.length;
  const doneCount =
    systemQuests.filter((item) => isCompleted(item.id)).length +
    replacementCustomItems.filter((c) => isCompleted(c.item_key)).length;
  const progressRatio = questTotal > 0 ? doneCount / questTotal : 0;
  // Milestones use the SAME count as claim_quest_bonus (0051): every
  // partner-approved item of this period completed by me (custom extras
  // included), not items of my list completed by anyone.
  const myApprovedCount = quests.progress.filter(
    (p) => p.period === period && p.period_key === periodKey && !!myId && p.completed_by === myId,
  ).length;

  const progressAnim = useRef(new Animated.Value(progressRatio)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressRatio,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, progressRatio]);

  const progressFillWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Submitting a quest = a pending action_request for the partner
  // (complete_quest_item). Guarded against double taps; after the call both
  // the quest list AND the couple's action requests are reloaded, so the
  // button flips to "awaiting approval" even if realtime lags. A `false`
  // from the server (already submitted / already done) is now shown.
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  // Shown right under the tapped item (not in the top banner, which is
  // off-screen once the list is scrolled -- that made a failed or
  // duplicate tap look like "nothing happens").
  const [questNotice, setQuestNotice] = useState<{ key: string; text: string } | null>(null);
  const handleCompleteQuest = async (item: DisplayQuest) => {
    if (item.completed || item.pending || submittingKey) return;
    setSubmittingKey(item.key);
    setQuestNotice(null);
    try {
      const { status, message } = await quests.completeItem(period, periodKey, item.key, item.title, item.points);
      try {
        await sync.refresh();
      } catch {
        // realtime will catch up; the result below is still shown
      }
      if (status === 'sent') haptics.success();
      else if (status === 'duplicate') setQuestNotice({ key: item.key, text: t('quests.alreadySubmitted') });
      else setQuestNotice({ key: item.key, text: message ?? t('quests.submitFailed') });
    } finally {
      setSubmittingKey(null);
    }
  };

  // Shown right under the milestone row, not in the top banner.
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const handleClaimMilestone = async (count: number, points: number) => {
    if (claimingMilestone !== null) return;
    haptics.confirm();
    setBonusError(null);
    setClaimingMilestone(count);
    try {
      const { ok, message } = await quests.claimBonus(
        period,
        periodKey,
        count,
        points,
        t('quests.progressLabel', { done: count, total: questTotal }),
      );
      if (ok) haptics.success();
      else setBonusError(message ?? t('quests.alreadySubmitted'));
    } finally {
      setClaimingMilestone(null);
    }
  };

  const customQuestPrice = nextCustomQuestPrice(period, questTotal, extraCustomItems.length);

  const openAddQuest = () => {
    setCustomQuestTitle('');
    setAddQuestOpen(true);
  };

  const submitCustomQuest = async () => {
    if (!customQuestTitle.trim()) return;
    haptics.confirm();
    const ok = await quests.addCustomItem(period, periodKey, customQuestTitle.trim(), customQuestPrice);
    if (ok) setAddQuestOpen(false);
  };

  const openReplace = (item: DisplayQuest) => {
    if (item.completed) return;
    setReplaceTitle('');
    setReplaceTarget(item);
  };

  const submitReplace = async () => {
    if (!replaceTarget || !replaceTitle.trim()) return;
    haptics.confirm();
    const ok = await quests.replaceStandardItem(period, periodKey, replaceTarget.key, replaceTarget.points, replaceTitle.trim());
    if (ok) setReplaceTarget(null);
  };

  if (!auth.configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('rewards.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  if (sync.loading && sync.rewardRequests.length === 0 && !sync.couple) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('rewards.title')} onBack={() => navigation.goBack()} />
        <LoadingState />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('rewards.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {!!sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}
      {!!quests.error && <BackendStatusBanner message={quests.error} onRetry={quests.clearError} />}
      <View style={[styles.balance, shadow.soft, { backgroundColor: colors.primary }]}>
        <Text style={[styles.balanceLabel, { color: colors.textOnPrimary }]}>{t('rewards.balanceLabel')}</Text>
        <Text style={[styles.balanceValue, { color: colors.textOnPrimary }]}>{sync.myStats.balance}</Text>
      </View>

      <FilterTabs
        options={periodTabs}
        value={period}
        onChange={(key) => {
          setBonusError(null);
          setPeriod(key as QuestPeriod);
        }}
      />

      {/* Same live progress bar in all four periods now (spec item 4) --
          real doneCount/questTotal from Supabase, not a separate counter. */}
      <View style={[styles.progressCard, shadow.soft, { backgroundColor: colors.primary }]}>
        <Animated.View
          style={[styles.progressFill, { width: progressFillWidth, backgroundColor: 'rgba(255,255,255,0.28)' }]}
        />
        <Text style={[styles.progressValue, { color: colors.textOnPrimary }]}>
          {t('quests.progressLabel', { done: doneCount, total: questTotal })}
        </Text>
      </View>

      {QUEST_BONUS_PERIODS.includes(period) && (
        <View style={styles.milestoneRow}>
          {(QUEST_BONUS_MILESTONES_BY_PERIOD[period] ?? []).map((m) => {
            // Filtered to MY OWN claims -- bonusClaims holds both partners'
            // rows for the couple, and progress/bonuses are tracked
            // separately per person (migration 0033).
            const claimed = quests.bonusClaims.some(
              (b) => b.user_id === auth.session?.user?.id && b.period === period && b.period_key === periodKey && b.milestone === m.count,
            );
            const pending = !claimed && isBonusPending(m.count);
            const reached = myApprovedCount >= m.count;
            return (
              <Pressable
                key={m.count}
                disabled={!reached || claimed || pending || claimingMilestone !== null}
                onPress={() => handleClaimMilestone(m.count, m.points)}
                style={[
                  styles.milestonePill,
                  {
                    backgroundColor: claimed ? colors.success : reached ? colors.primary : colors.card,
                    borderColor: reached || claimed ? 'transparent' : colors.border,
                  },
                ]}
              >
                <Text style={[styles.milestoneText, { color: reached || claimed ? colors.textOnPrimary : colors.textSecondary }]}>
                  {m.count} → +{m.points}
                </Text>
                {claimed && <Text style={[styles.milestoneSub, { color: colors.textOnPrimary }]}>{t('quests.milestoneClaimed')}</Text>}
                {pending && <Text style={[styles.milestoneSub, { color: colors.textOnPrimary }]}>{t('quests.pendingApproval')}</Text>}
                {reached && !claimed && !pending && (
                  <Text style={[styles.milestoneSub, { color: colors.textOnPrimary }]}>{t('quests.milestoneClaim')}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      {!!bonusError && <Text style={[styles.bonusError, { color: colors.danger }]}>{bonusError}</Text>}

      {displayQuests.map((item) => (
        <View key={item.key} style={[styles.questCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.questBody}>
            {item.difficulty && (
              <Text style={[styles.questDifficulty, { color: colors.textSecondary }]}>
                {t(`quests.difficulty_${item.difficulty}` as TranslationKey)}
              </Text>
            )}
            <Text style={[styles.questTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.questPoints, { color: colors.primary }]}>+{item.points}</Text>
            {item.isStandard && !item.completed && !item.pending && (
              <Pressable onPress={() => openReplace(item)} hitSlop={6}>
                <Text style={[styles.replaceLink, { color: colors.textSecondary }]}>{t('quests.replaceItem')}</Text>
              </Pressable>
            )}
          </View>
          {item.completed ? (
            <View style={[styles.questDoneBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.questDoneBadgeText}>✓</Text>
            </View>
          ) : item.pending ? (
            <Text style={[styles.questPendingLabel, { color: colors.textSecondary }]}>{t('quests.pendingApproval')}</Text>
          ) : (
            <PrimaryButton
              label={t('quests.markDone')}
              onPress={() => handleCompleteQuest(item)}
              loading={submittingKey === item.key}
              disabled={!!submittingKey}
              style={styles.questButton}
            />
          )}
          {questNotice?.key === item.key && (
            <Text style={[styles.questNotice, { color: colors.danger }]}>{questNotice.text}</Text>
          )}
        </View>
      ))}

      <Pressable onPress={openAddQuest} style={[styles.addQuestButton, { borderColor: colors.primary }]}>
        <Text style={[styles.addQuestText, { color: colors.primary }]}>{t('quests.addCustom')}</Text>
      </Pressable>
      </ScrollView>

      <Modal visible={addQuestOpen} transparent animationType="fade" onRequestClose={() => setAddQuestOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('quests.addCustomTitle')}</Text>
            <TextInput
              value={customQuestTitle}
              onChangeText={setCustomQuestTitle}
              placeholder={t('quests.customNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.customInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <Text style={[styles.customComputed, { color: colors.primary }]}>
              {t('quests.customPricePreview', { points: customQuestPrice })}
            </Text>
            <PrimaryButton
              label={t('quests.customAdd')}
              onPress={submitCustomQuest}
              disabled={!customQuestTitle.trim()}
              style={styles.modalButton}
            />
            <PrimaryButton label={t('quests.cancel')} onPress={() => setAddQuestOpen(false)} variant="outline" />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!replaceTarget} transparent animationType="fade" onRequestClose={() => setReplaceTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('quests.replaceItemTitle')}</Text>
            {!!replaceTarget && (
              <Text style={[styles.customComputed, { color: colors.textSecondary }]}>
                {t('quests.replaceItemFrom', { title: replaceTarget.title })}
              </Text>
            )}
            <TextInput
              value={replaceTitle}
              onChangeText={setReplaceTitle}
              placeholder={t('quests.customNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.customInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <Text style={[styles.customComputed, { color: colors.primary }]}>
              {t('quests.customPricePreview', { points: replaceTarget?.points ?? 0 })}
            </Text>
            <PrimaryButton
              label={t('quests.replaceItemConfirm')}
              onPress={submitReplace}
              disabled={!replaceTitle.trim()}
              style={styles.modalButton}
            />
            <PrimaryButton label={t('quests.cancel')} onPress={() => setReplaceTarget(null)} variant="outline" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  balance: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  progressCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  milestonePill: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  milestoneText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  bonusError: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  milestoneSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  questCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  questBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  questDifficulty: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  questTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  questPoints: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  replaceLink: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  questButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  questNotice: {
    width: '100%',
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  questPendingLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    maxWidth: 90,
    textAlign: 'right',
  },
  questDoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questDoneBadgeText: {
    color: '#fff',
    fontWeight: '800',
  },
  addQuestButton: {
    borderWidth: 1.5,
    borderRadius: radius.round,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addQuestText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  customInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  customComputed: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalButton: {
    marginBottom: spacing.sm,
  },
});
