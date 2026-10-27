import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useWishlist } from '../../store/WishlistContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond, formatUsd } from '../../utils/bond';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { DbWishlistItem } from '../../types/database';
import { wishDeadlineFeePoints } from '../../constants/wishFees';
import { generateRequestId } from '../../utils/requestId';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Wishlist'>;

// Deadline options (migration 0048), counted from the wish's created_at.
const DEADLINES: (1 | 24 | null)[] = [1, 24, null];

export const WishlistScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const wishlist = useWishlist();
  const sync = useCoupleSync();
  // Wishes live on the couple -- without a paired couple there is nowhere to
  // save them, so say so instead of silently ignoring "Add".
  const hasCouple = !!sync.couple;
  const bond = useBond();

  // Optional filter from the two Home cards ("Мои желания" / "Желания
  // партнёра") -- same list, same table, just a client-side slice by
  // created_by. Entry points that don't pass `owner` (AllSections,
  // CoupleProfile) keep showing the combined list, unchanged.
  const owner = route.params?.owner;
  const myId = auth.session?.user?.id;
  const visibleItems = !owner
    ? wishlist.items
    : wishlist.items.filter((item) => (owner === 'me' ? item.created_by === myId : item.created_by !== myId));
  // 'done' wishes leave the active list and are shown as history below.
  // A missing status (database without migration 0045) counts as active.
  const activeItems = visibleItems.filter((item) => (item.status ?? 'active') !== 'done');
  const doneItems = visibleItems.filter((item) => item.status === 'done');
  const [busyId, setBusyId] = useState<string | null>(null);
  const runForItem = async (id: string, fn: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };
  const screenTitle = owner === 'me' ? t('home.myWishes') : owner === 'partner' ? t('home.partnerWishes') : t('wishlist.title');

  const [title, setTitle] = useState('');
  const [offerPoints, setOfferPoints] = useState('');
  // Counter-offer input per wish (migration 0052).
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState('');
  const [deadline, setDeadline] = useState<1 | 24 | null>(null);
  // Kept across retries of the same submission so the server never charges
  // the deadline fee twice; cleared only after a successful save.
  const [addRequestId, setAddRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importantTarget, setImportantTarget] = useState<DbWishlistItem | null>(null);

  // Re-render every 30 s so "Просрочено" appears without leaving the screen.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const deadlineLabel = (h: 1 | 24 | null) =>
    h === 1 ? t('wishlist.deadline1h') : h === 24 ? t('wishlist.deadline1d') : t('wishlist.deadlineNone');
  const deadlineInfo = (item: DbWishlistItem) => {
    const hours = item.deadline_hours ?? null;
    if (hours == null) return { text: t('wishlist.deadlineNone'), overdue: false };
    const due = new Date(item.created_at).getTime() + hours * 3600 * 1000;
    const overdue = item.status !== 'done' && now > due;
    const time = new Date(due).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return {
      text: overdue ? t('wishlist.overdue') : `${deadlineLabel(hours === 1 ? 1 : 24)} · ${t('wishlist.deadlineUntil', { time })}`,
      overdue,
    };
  };

  // 🚨 Make important (1 BOND, server-side); errors show in the wishlist banner.
  const confirmImportant = async () => {
    const item = importantTarget;
    setImportantTarget(null);
    if (!item) return;
    if (await wishlist.makeImportant(item.id)) haptics.success();
  };

  const handleAdd = async () => {
    const offer = parseInt(offerPoints, 10);
    if (!title.trim() || !Number.isFinite(offer) || offer < 1 || offer > 500 || submitting) return;
    haptics.confirm();
    setSubmitting(true);
    try {
      // Keep what the user typed if saving failed.
      const requestId = addRequestId ?? generateRequestId();
      setAddRequestId(requestId);
      const saved = await wishlist.addItem({
        title: title.trim(),
        offerPoints: offer,
        deadlineHours: deadline,
        clientRequestId: requestId,
      });
      if (saved) {
        setTitle('');
        setOfferPoints('');
        setDeadline(null);
        setAddRequestId(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!wishlist.error && <BackendStatusBanner message={wishlist.error} onRetry={wishlist.clearError} />}
        {!hasCouple && <BackendStatusBanner message={t('compliments.noPartner')} />}
        {(() => {
          // What I (as executor) am still owed from fulfilled wishes.
          const owed = wishlist.items
            .filter((w) => w.completion_requested_by === myId && w.status === 'done')
            .reduce((sum, w) => sum + (w.payout_pending_points ?? 0), 0);
          return owed > 0 ? (
            <Text style={[styles.statusText, { color: colors.primary }]}>{t('wishlist.myDebtTotal', { points: owed })}</Text>
          ) : null;
        })()}
        {owner !== 'partner' && (
          <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('wishlist.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={offerPoints}
              onChangeText={(v) => setOfferPoints(v.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder={t('wishlist.rewardPlaceholder')}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <View style={styles.priorityRow}>
              {DEADLINES.map((h) => (
                <Pressable
                  key={String(h)}
                  onPress={() => setDeadline(h)}
                  style={[
                    styles.priorityChip,
                    {
                      borderColor: deadline === h ? colors.primary : colors.border,
                      backgroundColor: deadline === h ? colors.background : colors.card,
                      borderWidth: deadline === h ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.priorityChipText, { color: colors.primary }]}>{deadlineLabel(h)}</Text>
                </Pressable>
              ))}
            </View>
            {(() => {
              // Two separate amounts, never summed into one "reward":
              // the executor's reward (paid after completion) and the
              // urgency fee (charged now, goes to nobody).
              const reward = parseInt(offerPoints, 10) || 0;
              const fee = wishDeadlineFeePoints(deadline);
              return (
                <View style={styles.costBox}>
                  <Text style={[styles.costTotal, { color: colors.text }]}>
                    {t('wishlist.costReward', { points: reward })}
                  </Text>
                  <Text style={[styles.costLine, { color: colors.textSecondary }]}>
                    {fee > 0 ? t('wishlist.costDeadlinePoints', { points: fee }) : t('wishlist.costNoUrgencyFee')}
                  </Text>
                </View>
              );
            })()}
            <PrimaryButton
              label={t('wishlist.addButton')}
              onPress={handleAdd}
              disabled={!hasCouple || !title.trim() || !offerPoints.trim() || submitting}
              loading={submitting}
            />
          </View>
        )}

        {wishlist.loading && wishlist.items.length === 0 ? (
          <LoadingState />
        ) : activeItems.length === 0 ? (
          <EmptyState icon="goal" title={t('wishlist.emptyTitle')} description={t('wishlist.emptyDescription')} />
        ) : (
          activeItems.map((item) => {
            const isMine = item.created_by === myId;
            const isPending = item.status === 'pending';
            const busy = busyId === item.id;
            const dl = deadlineInfo(item);
            const nego = item.negotiation_status ?? 'none';
            const myTurn = nego === 'open' && item.offer_by !== myId;
            const canCounter = myTurn || (nego === 'declined' && isMine);
            const canMarkDone = nego === 'agreed' || nego === 'none';
            return (
              <View
                key={item.id}
                style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.priorityBadge, { backgroundColor: dl.overdue ? colors.danger : colors.primary }]}>
                    <Text style={styles.priorityBadgeText}>{dl.text}</Text>
                  </View>
                </View>
                {/* Price / bargaining state (migration 0052), in points. */}
                {nego === 'agreed' && (
                  <Text style={[styles.cardPrice, { color: colors.success }]}>
                    {t('wishlist.offerAgreed', { points: item.agreed_points ?? 0 })}
                  </Text>
                )}
                {nego === 'open' && (
                  <Text style={[styles.cardPrice, { color: colors.primary }]}>
                    {item.offer_by === myId
                      ? t('wishlist.offerFromMe', { points: item.offer_points ?? 0 })
                      : t('wishlist.offerFromPartner', { points: item.offer_points ?? 0 })}
                  </Text>
                )}
                {nego === 'declined' && (
                  <Text style={[styles.cardPrice, { color: colors.danger }]}>
                    {t('wishlist.offerDeclined', { points: item.offer_points ?? 0 })}
                  </Text>
                )}
                {nego === 'none' && item.offer_points != null && (
                  <Text style={[styles.cardPrice, { color: colors.primary }]}>
                    {t('wishlist.legacyPrice', { points: item.offer_points })}
                  </Text>
                )}
                {!!item.deadline_fee_points && (
                  <Text style={[styles.cardEquivalent, { color: colors.textSecondary }]}>
                    {t('wishlist.deadlineFeePaid', { bond: formatBond(bond.toBond(item.deadline_fee_points)) })}
                  </Text>
                )}
                {!isPending && myTurn && (
                  <View style={styles.actionRow}>
                    <PrimaryButton
                      label={t('wishlist.offerAccept')}
                      onPress={() => runForItem(item.id, async () => { await wishlist.respondOffer(item.id, 'accept'); })}
                      disabled={!!busyId}
                      style={styles.actionButton}
                    />
                    <PrimaryButton
                      label={t('wishlist.offerDecline')}
                      variant="outline"
                      onPress={() => runForItem(item.id, async () => { await wishlist.respondOffer(item.id, 'decline'); })}
                      disabled={!!busyId}
                      style={styles.actionButton}
                    />
                  </View>
                )}
                {!isPending && canCounter && (
                  <View style={[styles.actionRow, styles.counterRow]}>
                    <TextInput
                      value={counterFor === item.id ? counterValue : ''}
                      onFocus={() => {
                        if (counterFor !== item.id) {
                          setCounterFor(item.id);
                          setCounterValue('');
                        }
                      }}
                      onChangeText={(v) => {
                        setCounterFor(item.id);
                        setCounterValue(v.replace(/[^0-9]/g, '').slice(0, 3));
                      }}
                      placeholder={t('wishlist.offerCounterPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      style={[styles.input, styles.counterInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    />
                    <PrimaryButton
                      label={t('wishlist.offerCounter')}
                      variant="outline"
                      onPress={() => {
                        const v = parseInt(counterValue, 10);
                        if (counterFor !== item.id || !Number.isFinite(v)) return;
                        runForItem(item.id, async () => {
                          if (await wishlist.respondOffer(item.id, 'counter', v)) setCounterValue('');
                        });
                      }}
                      disabled={!!busyId || counterFor !== item.id || !counterValue}
                      style={styles.actionButton}
                    />
                  </View>
                )}
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {item.created_by === auth.session?.user?.id ? t('promises.me') : t('promises.partner')}
                </Text>
                {isPending && (
                  <Text style={[styles.statusText, { color: colors.primary }]}>
                    {isMine ? t('wishlist.pendingForAuthor') : t('wishlist.pendingStatus')}
                  </Text>
                )}
                {isPending && isMine && (
                  <View style={styles.actionRow}>
                    <PrimaryButton
                      label={t('wishlist.confirm')}
                      onPress={() => runForItem(item.id, () => wishlist.respondCompletion(item.id, true))}
                      loading={busy}
                      disabled={!!busyId}
                      style={styles.actionButton}
                    />
                    <PrimaryButton
                      label={t('wishlist.decline')}
                      variant="outline"
                      onPress={() => runForItem(item.id, () => wishlist.respondCompletion(item.id, false))}
                      disabled={!!busyId}
                      style={styles.actionButton}
                    />
                  </View>
                )}
                {!isPending && !isMine && !canMarkDone && (
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{t('wishlist.fixPriceFirst')}</Text>
                )}
                {!isPending && !isMine && canMarkDone && (
                  <PrimaryButton
                    label={t('wishlist.markDone')}
                    onPress={() => runForItem(item.id, () => wishlist.requestCompletion(item.id))}
                    loading={busy}
                    disabled={!!busyId}
                    style={styles.markDoneButton}
                  />
                )}
                {item.is_important && (
                  <Text style={[styles.statusText, { color: colors.danger }]}>{t('wishlist.importantBadge')}</Text>
                )}
                {!isPending && isMine && !item.is_important && (
                  <PrimaryButton
                    label={t('wishlist.importantButton')}
                    variant="outline"
                    onPress={() => setImportantTarget(item)}
                    disabled={!hasCouple}
                    colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
                    style={styles.markDoneButton}
                  />
                )}
                {!isPending && isMine && (
                  <Pressable onPress={() => wishlist.removeItem(item.id)} style={styles.removeButton}>
                    <Text style={[styles.removeButtonText, { color: colors.danger }]}>{t('wishlist.remove')}</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        {doneItems.length > 0 && (
          <>
            <Text style={[styles.historyTitle, { color: colors.text }]}>{t('wishlist.historyTitle')}</Text>
            {doneItems.map((item) => (
              <View
                key={item.id}
                style={[styles.card, styles.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[styles.statusText, { color: colors.success }]}>
                  {t('wishlist.doneStatus')}
                  {item.paid_at ? ` · ${t('wishlist.paidOut', { points: item.payout_points ?? 0 })}` : ''}
                  {item.payout_pending_points ? ` · ${t('wishlist.debtLeft', { points: item.payout_pending_points })}` : ''}
                  {item.completed_at ? ` · ${new Date(item.completed_at).toLocaleDateString()}` : ''}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {item.created_by === myId ? t('promises.me') : t('promises.partner')}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={!!importantTarget}
        title={t('wishlist.importantConfirmTitle')}
        message={t('wishlist.importantConfirmMessage')}
        confirmLabel={t('wishlist.importantConfirm')}
        onConfirm={confirmImportant}
        onCancel={() => setImportantTarget(null)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  form: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  priorityChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityChipText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  priorityBadgeText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
    fontWeight: '700',
    color: '#fff',
  },
  cardPrice: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  cardEquivalent: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
  counterRow: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  counterInput: {
    flex: 1,
    marginBottom: 0,
  },
  costBox: {
    marginBottom: spacing.sm,
  },
  costLine: {
    fontSize: fontSize.xs,
  },
  costTotal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  markDoneButton: {
    marginTop: spacing.xs,
  },
  historyTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  doneCard: {
    opacity: 0.75,
  },
  removeButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
