import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FilterTabs } from '../../components/common/FilterTabs';
import { EmptyState } from '../../components/common/EmptyState';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useTranslation } from '../../localization/useTranslation';
import { moodTranslationKey } from '../../utils/mood';

type Props = NativeStackScreenProps<RootStackParamList, 'MoodHistory'>;
type RangeKey = '7' | '30';

export const MoodHistoryScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userName } = useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  const interaction = useCoupleInteraction();
  const [range, setRange] = useState<RangeKey>('7');

  const days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (range === '7' ? 7 : 30));
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const dates = Array.from(new Set(interaction.moodHistory.map((m) => m.checkin_date)))
      .filter((d) => d >= cutoffIso)
      .sort((a, b) => b.localeCompare(a));

    return dates.map((date) => {
      const mine = interaction.moodHistory.find((m) => m.checkin_date === date && m.user_id === auth.session?.user?.id);
      const partner = interaction.moodHistory.find((m) => m.checkin_date === date && m.user_id === sync.partner?.id);
      return { date, mine: mine?.mood ?? null, partner: partner?.mood ?? null };
    });
  }, [interaction.moodHistory, range, auth.session?.user?.id, sync.partner?.id]);

  return (
    <ScreenContainer>
      <ScreenHeader title={t('moodHistory.title')} onBack={() => navigation.goBack()} />
      <FilterTabs
        options={[
          { key: '7', label: t('moodHistory.range7') },
          { key: '30', label: t('moodHistory.range30') },
        ]}
        value={range}
        onChange={(key) => setRange(key as RangeKey)}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {days.length === 0 ? (
          <EmptyState
            icon="history"
            title={t('moodHistory.emptyTitle')}
            description={t('moodHistory.emptyDescription')}
          />
        ) : (
          days.map((day) => (
            <View key={day.date} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.date, { color: colors.text }]}>
                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{userName}</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {day.mine ? t(moodTranslationKey(day.mine)) : t('moodHistory.noEntry')}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  {sync.partner?.name ?? t('moodHistory.partner')}
                </Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {day.partner ? t(moodTranslationKey(day.partner)) : t('moodHistory.noEntry')}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  date: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rowLabel: {
    fontSize: fontSize.xs,
  },
  rowValue: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
