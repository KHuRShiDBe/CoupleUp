import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ActionListItem } from '../../components/cards/ActionListItem';
import { FilterTabs } from '../../components/common/FilterTabs';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleOffers } from '../../store/CoupleOffersContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { toActionHistoryItem } from '../../utils/actionDisplay';
import { CoupleOfferStatus } from '../../types/database';

type FilterKey = 'all' | 'mine' | 'partner' | 'penalty';

const AGREEMENT_STATUS_KEY: Record<CoupleOfferStatus, TranslationKey> = {
  pending: 'coupleOffers.statusPending',
  accepted: 'coupleOffers.statusAccepted',
  declined: 'coupleOffers.statusDeclined',
  completed: 'coupleOffers.statusCompleted',
  failed: 'coupleOffers.statusFailed',
  cancel_pending: 'coupleOffers.statusCancelPending',
  cancelled: 'coupleOffers.statusCancelled',
};

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export const HistoryScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const loading = useMockLoading();
  const { userName, selectedAvatar } = useAppStore();
  const sync = useCoupleSync();
  const offers = useCoupleOffers();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filters = [
    { key: 'all', label: t('history.filterAll') },
    { key: 'mine', label: t('history.filterMine') },
    { key: 'partner', label: t('history.filterPartner') },
    { key: 'penalty', label: t('history.filterPenalty') },
  ];

  const history = useMemo(
    () =>
      sync.actionsList.map((a) =>
        toActionHistoryItem(a, {
          myId: sync.userId ?? '',
          myRole: role,
          myAvatar: selectedAvatar,
          myName: userName,
          partner: sync.partner,
          partnerFallbackName: t('home.notConnected'),
        }),
      ),
    [sync.actionsList, sync.userId, sync.partner, role, selectedAvatar, userName, t],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'mine':
        return history.filter((item) => item.authorRole === role);
      case 'partner':
        return history.filter((item) => item.authorRole !== role);
      case 'penalty':
        return history.filter((item) => item.points < 0);
      default:
        return history;
    }
  }, [history, role, filter]);

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('history.title')} onBack={() => navigation.goBack()} />
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={t('history.title')} onBack={() => navigation.goBack()} />
      <FilterTabs options={filters} value={filter} onChange={(key) => setFilter(key as FilterKey)} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActionListItem item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="history" title={t('history.emptyTitle')} description={t('history.emptyDescription')} />
        }
        ListFooterComponent={
          offers.offers.length === 0 ? null : (
            <View style={styles.agreementsSection}>
              <Text style={[styles.agreementsTitle, { color: colors.text }]}>{t('history.agreementsTitle')}</Text>
              {offers.offers.map((o) => (
                <View key={o.id} style={[styles.agreementRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.agreementTitle, { color: colors.text }]} numberOfLines={1}>
                    {o.title}
                  </Text>
                  <View style={styles.agreementMetaRow}>
                    <Text style={[styles.agreementPoints, { color: colors.primary }]}>{o.price_points}</Text>
                    <Text style={[styles.agreementStatus, { color: colors.textSecondary }]}>{t(AGREEMENT_STATUS_KEY[o.status])}</Text>
                  </View>
                  {!!o.deadline && (
                    <Text style={[styles.agreementDeadline, { color: colors.textSecondary }]}>
                      {t('coupleOffers.deadlineIs', { date: new Date(o.deadline).toLocaleDateString() })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xl,
  },
  agreementsSection: {
    marginTop: spacing.lg,
  },
  agreementsTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  agreementRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  agreementTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  agreementMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agreementPoints: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  agreementStatus: {
    fontSize: fontSize.xs,
  },
  agreementDeadline: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
