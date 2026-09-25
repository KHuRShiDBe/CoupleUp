import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { FilterTabs } from '../../components/common/FilterTabs';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Requests'>;
type ItemKind = 'reward' | 'purchase' | 'penalty';
type ItemStatus = 'pending' | 'accepted' | 'declined';
type Direction = 'incoming' | 'outgoing';
type Filter = 'all' | 'incoming' | 'outgoing' | 'pending' | 'accepted' | 'declined';

interface InboxItem {
  id: string;
  kind: ItemKind;
  direction: Direction;
  status: ItemStatus;
  title: string;
  description: string;
  createdAt: string;
  // Purchase requests only -- an active (not yet resolved) counter-offer,
  // see migration 0020 / PurchaseRequestScreen for the full negotiation UI.
  activeOfferId?: string;
  activeOfferPrice?: number;
}

export const RequestsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const myId = auth.session?.user?.id ?? null;
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmTarget, setConfirmTarget] = useState<InboxItem | null>(null);

  const filterOptions = [
    { key: 'all', label: t('requests.filterAll') },
    { key: 'incoming', label: t('requests.filterIncoming') },
    { key: 'outgoing', label: t('requests.filterOutgoing') },
    { key: 'pending', label: t('requests.filterPending') },
    { key: 'accepted', label: t('requests.filterAccepted') },
    { key: 'declined', label: t('requests.filterDeclined') },
  ];

  const items = useMemo<InboxItem[]>(() => {
    const list: InboxItem[] = [];

    sync.rewardRequests.forEach((r) =>
      list.push({
        id: r.id,
        kind: 'reward',
        direction: r.requested_by === myId ? 'outgoing' : 'incoming',
        status: r.status === 'accepted' ? 'accepted' : r.status === 'rejected' ? 'declined' : 'pending',
        title: r.title,
        description: `${r.cost} ${t('requests.pointsWord')}${r.message ? ` · ${r.message}` : ''}`,
        createdAt: r.created_at,
      }),
    );

    budget.purchaseRequests.forEach((p) => {
      const activeOffer = budget.purchaseRequestOffers.find((o) => o.purchase_request_id === p.id && o.status === 'pending');
      list.push({
        id: p.id,
        kind: 'purchase',
        direction: p.requested_by === myId ? 'outgoing' : 'incoming',
        status: p.status === 'approved' ? 'accepted' : p.status === 'declined' ? 'declined' : 'pending',
        title: p.title,
        description: `$${p.price_usd.toFixed(2)}${p.note ? ` · ${p.note}` : ''}`,
        createdAt: p.created_at,
        activeOfferId: activeOffer?.id,
        activeOfferPrice: activeOffer?.price_usd,
      });
    });

    sync.penalties.forEach((p) =>
      list.push({
        id: p.id,
        kind: 'penalty',
        direction: p.created_by === myId ? 'outgoing' : 'incoming',
        status: p.status === 'confirmed' ? 'accepted' : p.status === 'rejected' ? 'declined' : 'pending',
        title: p.title,
        description: `-${p.points} ${t('requests.pointsWord')}`,
        createdAt: p.created_at,
      }),
    );

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [sync.rewardRequests, budget.purchaseRequests, budget.purchaseRequestOffers, sync.penalties, myId, t]);

  const filtered = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'incoming' || filter === 'outgoing') return item.direction === filter;
    return item.status === filter;
  });

  const typeLabel = (kind: ItemKind) =>
    kind === 'reward' ? t('requests.typeReward') : kind === 'purchase' ? t('requests.typePurchase') : t('requests.typePenalty');

  const respond = async (item: InboxItem, accept: boolean) => {
    haptics.success();
    if (item.kind === 'reward') await sync.respondRewardRequest(item.id, accept);
    if (item.kind === 'penalty') await sync.respondPenalty(item.id, accept);
    if (item.kind === 'purchase') await budget.respondPurchaseRequest(item.id, accept ? 'approved' : 'declined');
  };

  const handleAccept = (item: InboxItem) => setConfirmTarget(item);
  const handleDecline = (item: InboxItem) => respond(item, false);
  const respondToOffer = (offerId: string, accept: boolean) => {
    haptics.success();
    budget.respondCounterOffer(offerId, accept);
  };
  const confirmAccept = () => {
    if (!confirmTarget) return;
    respond(confirmTarget, true);
    setConfirmTarget(null);
  };

  const loading = sync.loading || budget.loading;
  const error = sync.error ?? budget.error;

  if (!auth.configured) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('requests.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={t('requests.title')} onBack={() => navigation.goBack()} />
      {loading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {!!error && <BackendStatusBanner message={error} onRetry={() => { sync.clearError(); budget.clearError(); }} />}
          <FilterTabs options={filterOptions} value={filter} onChange={(k) => setFilter(k as Filter)} />
          {filtered.length === 0 ? (
            <EmptyState icon="notification" title={t('requests.emptyTitle')} description={t('requests.emptyDescription')} />
          ) : (
            filtered.map((item) => (
              <View
                key={`${item.kind}-${item.id}`}
                style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.fromLabel, { color: colors.textSecondary }]}>
                    {item.direction === 'outgoing' ? t('requests.fromMeShort') : t('requests.fromPartnerShort')}
                    {' · '}
                    {typeLabel(item.kind)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.statusText, { color: colors.primary }]}>{t(`requests.status_${item.status}`)}</Text>
                  </View>
                </View>

                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>

                {/* Purchase request with an active counter-offer: the requester
                    (outgoing side) decides on the offer itself; the recipient
                    (incoming side) who proposed it just sees it's pending. */}
                {item.kind === 'purchase' && item.activeOfferId && item.status === 'pending' ? (
                  item.direction === 'outgoing' ? (
                    <View style={[styles.offerBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.offerLabel, { color: colors.text }]}>
                        {t('purchaseRequests.counterOffer', { price: (item.activeOfferPrice ?? 0).toFixed(2) })}
                      </Text>
                      <View style={styles.actionsRow}>
                        <PrimaryButton
                          label={t('purchaseRequests.acceptOffer')}
                          onPress={() => respondToOffer(item.activeOfferId!, true)}
                          style={styles.actionButton}
                        />
                        <PrimaryButton
                          label={t('purchaseRequests.declineOffer')}
                          onPress={() => respondToOffer(item.activeOfferId!, false)}
                          variant="outline"
                          style={styles.actionButton}
                        />
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.offerWaitingText, { color: colors.textSecondary }]}>{t('purchaseRequests.offerWaiting')}</Text>
                  )
                ) : (
                  item.direction === 'incoming' &&
                  item.status === 'pending' && (
                    <View style={styles.actionsRow}>
                      <PrimaryButton label={t('requests.accept')} onPress={() => handleAccept(item)} style={styles.actionButton} />
                      <PrimaryButton
                        label={t('requests.decline')}
                        onPress={() => handleDecline(item)}
                        variant="outline"
                        style={styles.actionButton}
                      />
                    </View>
                  )
                )}
                {item.kind === 'purchase' && item.direction === 'incoming' && item.status === 'pending' && !item.activeOfferId && (
                  <PrimaryButton
                    label={t('purchaseRequests.proposeCounter')}
                    onPress={() => navigation.navigate('PurchaseRequests')}
                    variant="outline"
                    style={styles.counterLinkButton}
                  />
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={!!confirmTarget}
        title={confirmTarget?.kind === 'penalty' ? t('requests.confirmPenaltyTitle') : t('requests.confirmRewardTitle')}
        message={
          confirmTarget?.kind === 'penalty'
            ? t('requests.confirmPenaltyMessage', { title: confirmTarget.title })
            : confirmTarget
              ? t('requests.confirmRewardMessage', { title: confirmTarget.title })
              : undefined
        }
        confirmLabel={t('requests.confirmButton')}
        cancelLabel={t('requests.cancelButton')}
        danger={confirmTarget?.kind === 'penalty'}
        onConfirm={confirmAccept}
        onCancel={() => setConfirmTarget(null)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
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
    marginBottom: spacing.sm,
  },
  fromLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 44,
  },
  offerBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  offerLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  offerWaitingText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  counterLinkButton: {
    height: 40,
    marginTop: spacing.sm,
  },
});
