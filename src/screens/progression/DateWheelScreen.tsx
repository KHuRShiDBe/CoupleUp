import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { DATE_IDEAS, DATE_IDEA_CATEGORIES, DateIdeaCategory } from '../../constants/dateIdeas';

type Props = NativeStackScreenProps<RootStackParamList, 'DateWheel'>;
type CategoryFilter = 'all' | DateIdeaCategory;

export const DateWheelScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const pool = category === 'all' ? DATE_IDEAS : DATE_IDEAS.filter((i) => i.category === category);
  const picked = pool.find((i) => i.key === pickedKey) ?? null;

  const categoryFilters = [
    { key: 'all', label: t('dateIdeas.categoryAll') },
    ...DATE_IDEA_CATEGORIES.map((c) => ({ key: c, label: t(`dateIdeas.category_${c}`) })),
  ];

  const pickIdea = () => {
    if (pool.length === 0) return;
    haptics.select();
    const options = pickedKey ? pool.filter((i) => i.key !== pickedKey) : pool;
    const source = options.length > 0 ? options : pool;
    const next = source[Math.floor(Math.random() * source.length)];
    setPickedKey(next.key);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('dateWheel.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('dateWheel.subtitle')}</Text>
        <FilterTabs
          options={categoryFilters}
          value={category}
          onChange={(key) => {
            setCategory(key as CategoryFilter);
            setPickedKey(null);
          }}
        />
        <View style={[styles.resultCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {picked ? (
            <>
              <Text style={[styles.resultCategory, { color: colors.primary }]}>{t(`dateIdeas.category_${picked.category}`)}</Text>
              <Text style={[styles.resultTitle, { color: colors.text }]}>{t(picked.titleKey)}</Text>
            </>
          ) : (
            <Text style={[styles.placeholder, { color: colors.textSecondary }]}>{t('dateWheel.placeholder')}</Text>
          )}
        </View>
        <PrimaryButton label={picked ? t('dateWheel.pickAgain') : t('dateWheel.pick')} onPress={pickIdea} disabled={pool.length === 0} />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  resultCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginVertical: spacing.lg,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCategory: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholder: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
