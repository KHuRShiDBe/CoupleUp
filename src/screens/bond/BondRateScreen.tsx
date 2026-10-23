import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { HowItWorksNote } from '../../components/common/HowItWorksNote';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond, formatUsd } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'BondRate'>;

export const BondRateScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const bond = useBond();

  const myPoints = sync.myStats.balance;
  const myBond = bond.toBond(myPoints);

  const current = bond.history[0] ?? null;
  const previous = bond.history[1] ?? null;
  const change = current && previous ? current.points_per_bond - previous.points_per_bond : null;

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('bond.rateTitle')} onBack={() => navigation.goBack()} />
      {bond.loading ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <HowItWorksNote text={t('bond.howItWorksText')} />
          <View style={[styles.rateCard, shadow.soft, { backgroundColor: colors.primary }]}>
            <Text style={[styles.rateLine, { color: colors.textOnPrimary }]}>
              {t('bond.rateLine', { points: bond.pointsPerBond })}
            </Text>
            <Text style={[styles.usdLine, { color: colors.textOnPrimary }]}>{t('bond.usdLine')}</Text>
            {change !== null && change !== 0 && (
              <Text style={[styles.changeLine, { color: colors.textOnPrimary }]}>
                {t('bond.previousRate', { points: previous!.points_per_bond })} ({change > 0 ? '+' : ''}
                {change})
              </Text>
            )}
          </View>

          <View style={[styles.balanceCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('bond.yourBalance')}</Text>
            <Text style={[styles.pointsValue, { color: colors.text }]}>{myPoints}</Text>
            <Text style={[styles.pointsSuffix, { color: colors.textSecondary }]}>{t('bond.points')}</Text>
            <View style={[styles.equivalentRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.equivalentLabel, { color: colors.textSecondary }]}>{t('bond.equivalent')}</Text>
              <Text style={[styles.equivalentValue, { color: colors.primary }]}>
                ≈ {formatBond(myBond)} BOND · ≈ {formatUsd(myBond)}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => navigation.navigate('BondCollection')} style={styles.collectionLink}>
            <Text style={[styles.collectionLinkText, { color: colors.primary }]}>{t('bond.collectionTitle')} →</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bond.rateHistory')}</Text>
          {bond.history.map((row) => (
            <View
              key={row.id}
              style={[styles.historyRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.historyLeft}>
                <Text style={[styles.historyRate, { color: colors.text }]}>
                  {t('bond.rateLine', { points: row.points_per_bond })}
                </Text>
                {row.is_holiday && (
                  <View style={[styles.holidayBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.holidayBadgeText}>{t('bond.holidayRate')}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                {new Date(row.effective_from).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  rateCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  rateLine: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  usdLine: {
    fontSize: fontSize.sm,
    opacity: 0.9,
  },
  changeLine: {
    fontSize: fontSize.xs,
    opacity: 0.85,
    marginTop: spacing.sm,
  },
  balanceCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  pointsValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  pointsSuffix: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  equivalentRow: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  equivalentLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  equivalentValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  collectionLink: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  collectionLinkText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  historyRate: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  historyDate: {
    fontSize: fontSize.xs,
  },
  holidayBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  holidayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
