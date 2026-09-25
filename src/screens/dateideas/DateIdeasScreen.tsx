import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { EmptyState } from '../../components/common/EmptyState';
import { usePlanning } from '../../store/PlanningContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond, formatUsd } from '../../utils/bond';
import { DATE_IDEAS, DATE_IDEA_CATEGORIES, DateIdeaCategory } from '../../constants/dateIdeas';

type Props = NativeStackScreenProps<RootStackParamList, 'DateIdeas'>;
type Tab = 'browse' | 'saved';
type CategoryFilter = 'all' | DateIdeaCategory;

export const DateIdeasBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const planning = usePlanning();
  const bond = useBond();
  const [tab, setTab] = useState<Tab>('browse');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const filteredIdeas = useMemo(
    () => (category === 'all' ? DATE_IDEAS : DATE_IDEAS.filter((i) => i.category === category)),
    [category],
  );

  const handleSave = (ideaKey: string, title: string, cat: DateIdeaCategory) => {
    const raw = priceDrafts[ideaKey];
    const price = raw ? parseFloat(raw.replace(',', '.')) : undefined;
    haptics.confirm();
    planning.saveDateIdea({ ideaKey, title, category: cat, priceUsd: Number.isFinite(price) ? price : undefined });
  };

  const categoryFilters = [
    { key: 'all', label: t('dateIdeas.categoryAll') },
    ...DATE_IDEA_CATEGORIES.map((c) => ({ key: c, label: t(`dateIdeas.category_${c}`) })),
  ];

  return (
    <>
      <View style={styles.tabRow}>
        <PrimaryButton
          label={t('dateIdeas.tabBrowse')}
          onPress={() => setTab('browse')}
          variant={tab === 'browse' ? 'primary' : 'outline'}
          style={styles.tabButton}
        />
        <PrimaryButton
          label={t('dateIdeas.tabSaved')}
          onPress={() => setTab('saved')}
          variant={tab === 'saved' ? 'primary' : 'outline'}
          style={styles.tabButton}
        />
      </View>

      {tab === 'browse' ? (
        <>
          <FilterTabs options={categoryFilters} value={category} onChange={(key) => setCategory(key as CategoryFilter)} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {filteredIdeas.map((idea) => (
              <View key={idea.key} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t(idea.titleKey)}</Text>
                <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>{t(`dateIdeas.category_${idea.category}`)}</Text>
                <View style={styles.saveRow}>
                  <TextInput
                    value={priceDrafts[idea.key] ?? ''}
                    onChangeText={(v) => setPriceDrafts((prev) => ({ ...prev, [idea.key]: v.replace(/[^0-9.,]/g, '') }))}
                    placeholder={t('dateIdeas.pricePlaceholderOptional')}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.priceInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  />
                  <PrimaryButton
                    label={t('dateIdeas.save')}
                    onPress={() => handleSave(idea.key, t(idea.titleKey), idea.category)}
                    style={styles.saveButton}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {planning.dateIdeaSaves.length === 0 ? (
            <EmptyState icon="goal" title={t('dateIdeas.emptySavedTitle')} description={t('dateIdeas.emptySavedDescription')} />
          ) : (
            planning.dateIdeaSaves.map((saved) => {
              const points = saved.price_usd != null ? bond.toPoints(saved.price_usd) : null;
              return (
                <View key={saved.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{saved.title}</Text>
                  <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>
                    {t(`dateIdeas.category_${saved.category as DateIdeaCategory}`)}
                  </Text>
                  {points !== null && (
                    <Text style={[styles.priceLine, { color: colors.primary }]}>
                      {Math.round(points)} {t('bond.points')} · ≈ {formatBond(saved.price_usd!)} BOND · ≈ {formatUsd(saved.price_usd!)}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );
};

export const DateIdeasScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('dateIdeas.title')} onBack={() => navigation.goBack()} />
      <DateIdeasBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    height: 44,
  },
  scroll: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardCategory: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  saveRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  priceInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  priceLine: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
