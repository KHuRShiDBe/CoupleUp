import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { QuickActionCard } from '../../components/cards/QuickActionCard';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sections'>;

export const AllSectionsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <ScreenHeader title={t('hubs.allSectionsTitle')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.quickGrid}>
          <QuickActionCard label={t('hubs.analyticsTitle')} icon="achievement" onPress={() => navigation.navigate('Analytics')} />
          <QuickActionCard label={t('hubs.coupleModulesTitle')} icon="pair" onPress={() => navigation.navigate('CoupleModules')} />
          <QuickActionCard label={t('finance.title')} icon="shop" onPress={() => navigation.navigate('Finance')} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('hubs.groupTasks')}</Text>
        <View style={styles.quickGrid}>
          <QuickActionCard label={t('tasks.title')} icon="tasks" onPress={() => navigation.navigate('Tasks')} />
          <QuickActionCard label={t('achievements.title')} icon="achievement" onPress={() => navigation.navigate('Achievements')} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('hubs.groupGames')}</Text>
        <View style={styles.quickGrid}>
          <QuickActionCard label={t('games.title')} icon="shop" onPress={() => navigation.navigate('Games')} />
          <QuickActionCard label={t('weeklyChallenges.title')} icon="goal" onPress={() => navigation.navigate('WeeklyChallenges')} />
          <QuickActionCard label={t('dateWheel.title')} icon="message" onPress={() => navigation.navigate('DateWheel')} />
          <QuickActionCard label={t('coupleQuiz.title')} icon="achievement" onPress={() => navigation.navigate('CoupleQuiz')} />
          <QuickActionCard label={t('rewardChest.title')} icon="rewards" onPress={() => navigation.navigate('CoupleRewardChest')} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('hubs.groupMore')}</Text>
        <View style={styles.quickGrid}>
          <QuickActionCard label={t('reminders.title')} icon="notification" onPress={() => navigation.navigate('Reminders')} />
          <QuickActionCard label={t('moodHistory.title')} icon="history" onPress={() => navigation.navigate('MoodHistory')} />
          <QuickActionCard label={t('wishlist.title')} icon="goal" onPress={() => navigation.navigate('Wishlist')} />
          <QuickActionCard label={t('purchaseRequests.title')} icon="lock" onPress={() => navigation.navigate('PurchaseRequests')} />
          <QuickActionCard label={t('themeStore.title')} icon="shop" onPress={() => navigation.navigate('ThemeStore')} />
          <QuickActionCard label={t('support.title')} icon="message" onPress={() => navigation.navigate('Support')} />
          <QuickActionCard label={t('bond.collectionTitle')} icon="achievement" onPress={() => navigation.navigate('BondCollection')} />
          <QuickActionCard label={t('bond.rateTitle')} icon="history" onPress={() => navigation.navigate('BondRate')} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
