import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList } from '../../navigation/types';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { maleHomeDark } from '../../theme/maleHomeDark';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { Avatar } from '../../components/common/Avatar';
import { QuickActionCard } from '../../components/cards/QuickActionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useCoupleStats } from '../../store/useCoupleStats';
import { useQuests } from '../../store/QuestsContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';
import { MOOD_OPTIONS, MOOD_EMOJI, moodTranslationKey } from '../../utils/mood';
import { MoodValue } from '../../types/database';
import { QuestPeriod } from '../../types/database';
import { QUEST_BONUS_MILESTONES, QUEST_ITEMS_PER_PERIOD } from '../../constants/questEconomy';
import { getPeriodKey } from '../../constants/questSelection';
import { wishlistIcons } from '../../constants/wishlistIcons';

// Reusing the existing roulette wheel artwork -- see RewardsScreen, which
// uses the same file for the roulette entry points.
const ROULETTE_ICON = require('../../../assets/roulette/intimate-roulette-icon.png');

const SAVINGS_ICONS = {
  // Swapped to the newer files -- old assets/savings/{male,female}-savings1.png kept on disk, unused.
  male: require('../../../assets/png/male-savings1.png'),
  female: require('../../../assets/png/female-savings1.png'),
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Weekly/monthly/yearly periods are still fully functional in the backend
// (quests, rewards catalog by period, etc.) -- they're just not surfaced as
// quick-access cards on Home anymore. Reachable via Rewards screen's own
// period tabs. The "Каждую неделю" card's old slot is now "Мои накопления"
// (see SAVINGS_ICONS / WishHomeCard below).
const PERIOD_CARDS: { period: QuestPeriod; tabKey: TranslationKey; icon: 'periodDaily' | 'periodWeekly' | 'periodMonthly' | 'periodYearly' }[] = [
  { period: 'daily', tabKey: 'quests.tabDaily', icon: 'periodDaily' },
];

// Same size/shape as QuickActionCard (same grid), but takes a resolved
// image source directly instead of an IconName -- QuickActionCard's
// IconImage always renders the VIEWER's own role icon, which can't express
// "show this card in the PARTNER's role color" for the wishes-of-partner
// card below.
const WishHomeCard = ({ label, iconSource, onPress }: { label: string; iconSource: any; onPress: () => void }) => {
  const { colors, role } = useTheme();
  // Local to HomeScreen only -- safe to branch by role here without
  // affecting any other screen (see maleHomeDark.ts).
  const dark = role === 'male';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wishCard,
        shadow.soft,
        {
          backgroundColor: dark ? maleHomeDark.cardBg : colors.card,
          borderColor: dark ? maleHomeDark.border : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.wishIconWrap, { backgroundColor: dark ? maleHomeDark.cardBgAlt : colors.background }]}>
        <Image source={iconSource} style={styles.wishIconImage} resizeMode="contain" />
      </View>
      <Text style={[styles.wishLabel, { color: dark ? maleHomeDark.textPrimary : colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
};

export const HomeScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const loading = useMockLoading();
  const { userName, selectedAvatar } = useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  const bond = useBond();
  const interaction = useCoupleInteraction();
  const stats = useCoupleStats();
  const quests = useQuests();
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);

  const partnerRole = sync.partner?.role ?? (role === 'male' ? 'female' : 'male');
  const coupleId = sync.couple?.id ?? null;

  const todayKey = getPeriodKey('daily');
  const myId = auth.session?.user?.id;
  // My own completions only -- progress/milestones are tracked separately
  // per person (migration 0033), not combined for the couple.
  const doneCount = quests.progress.filter(
    (p) => p.period === 'daily' && p.period_key === todayKey && p.completed_by === myId,
  ).length;
  const nextMilestone = QUEST_BONUS_MILESTONES.find(
    (m) => doneCount < m.count || !quests.bonusClaims.some((b) => b.user_id === myId && b.period === 'daily' && b.period_key === todayKey && b.milestone === m.count),
  );

  // Premium dark-navy Home treatment, male account only -- every other
  // screen and the whole female theme are untouched (see maleHomeDark.ts).
  const dark = role === 'male';

  const handlePickMood = (mood: MoodValue) => {
    haptics.select();
    interaction.submitMood(mood);
    setMoodPickerOpen(false);
  };

  if (loading) {
    return (
      <ScreenBackground>
        <ScreenContainer inTabBar transparent>
          <LoadingState lines={4} />
        </ScreenContainer>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScreenContainer inTabBar transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: dark ? maleHomeDark.textSecondary : colors.textSecondary }]}>{t('home.greeting')}</Text>
            <Text style={[styles.userName, { color: dark ? maleHomeDark.textPrimary : colors.text }]}>{userName}</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => navigation.navigate('RouletteHub')}
              hitSlop={6}
              style={[
                styles.settingsButton,
                { backgroundColor: dark ? maleHomeDark.cardBg : colors.card, borderColor: dark ? maleHomeDark.border : colors.border },
              ]}
            >
              <Image source={ROULETTE_ICON} style={styles.rouletteHeaderIcon} resizeMode="contain" />
            </Pressable>
          </View>
        </View>

        {(() => {
          const BalanceWrap = dark ? LinearGradient : View;
          const balanceWrapProps = dark
            ? {
                colors: [maleHomeDark.cardBg, maleHomeDark.cardBgAlt] as [string, string],
                start: { x: 0, y: 0 },
                end: { x: 1, y: 1 },
                style: [styles.balanceCard, shadow.soft, { borderWidth: 1, borderColor: maleHomeDark.border }],
              }
            : { style: [styles.balanceCard, shadow.soft, { backgroundColor: colors.primary }] };
          return (
            <BalanceWrap {...(balanceWrapProps as any)}>
              <View style={styles.pairRow}>
                <View style={styles.pairPerson}>
                  <Avatar role={role} avatarId={selectedAvatar} photoUrl={auth.profile?.photo_url} size={48} />
                  <Text style={[styles.pairName, { color: colors.textOnPrimary }]} numberOfLines={1}>
                    {userName}
                  </Text>
                  <Text style={[styles.pairPoints, { color: colors.textOnPrimary }]}>
                    {t('home.bondSuffix', { bond: formatBond(bond.toBond(sync.myStats.balance)) })}
                  </Text>
                </View>
                <View style={styles.pairPerson}>
                  <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} photoUrl={sync.partner?.photo_url} size={48} />
                  <Text style={[styles.pairName, { color: colors.textOnPrimary }]} numberOfLines={1}>
                    {sync.partner?.name ?? t('home.notConnected')}
                  </Text>
                  <Text style={[styles.pairPoints, { color: colors.textOnPrimary }]}>
                    {t('home.bondSuffix', { bond: formatBond(bond.toBond(sync.partnerStats.balance)) })}
                  </Text>
                </View>
              </View>

              <View style={styles.balanceRow}>
                <Text style={[styles.balanceLabel, { color: colors.textOnPrimary }]}>{t('bond.rateTitle')}</Text>
                <Text style={[styles.balanceValue, { color: colors.textOnPrimary }]}>
                  {t('bond.rateLine', { points: bond.pointsPerBond })}
                </Text>
              </View>
            </BalanceWrap>
          );
        })()}

        <View
          style={[
            styles.todayCard,
            shadow.soft,
            { backgroundColor: dark ? maleHomeDark.cardBg : colors.card, borderColor: dark ? maleHomeDark.border : colors.border },
          ]}
        >
          <Text style={[styles.todayProgress, { color: dark ? maleHomeDark.textPrimary : colors.text }]}>
            {t('quests.progressLabel', { done: doneCount, total: QUEST_ITEMS_PER_PERIOD })}
          </Text>
          <Text style={[styles.todayStreak, { color: dark ? maleHomeDark.textSecondary : colors.textSecondary }]}>
            {stats.currentStreak > 0 ? t('home.streak', { count: stats.currentStreak }) : t('home.streakEmpty')}
          </Text>
          <Text style={[styles.todayMilestone, { color: dark ? maleHomeDark.accent : colors.primary }]}>
            {nextMilestone
              ? t('home.nextMilestone', { count: nextMilestone.count, points: nextMilestone.points })
              : t('home.allMilestonesDone')}
          </Text>
        </View>

        <Pressable
          onPress={() => setMoodPickerOpen(true)}
          style={[
            styles.moodRow,
            shadow.soft,
            { backgroundColor: dark ? maleHomeDark.cardBg : colors.card, borderColor: dark ? maleHomeDark.border : colors.border },
          ]}
        >
          <Text style={[styles.moodLine, { color: dark ? maleHomeDark.textPrimary : colors.text }]}>
            {t('home.myMoodRow', {
              emoji: interaction.myMoodToday ? MOOD_EMOJI[interaction.myMoodToday] : '❔',
              label: interaction.myMoodToday ? t(moodTranslationKey(interaction.myMoodToday)) : t('home.moodNotSet'),
            })}
          </Text>
          <Text style={[styles.moodLine, { color: dark ? maleHomeDark.textSecondary : colors.textSecondary }]}>
            {t('home.partnerMoodRow', {
              emoji: interaction.partnerMoodToday ? MOOD_EMOJI[interaction.partnerMoodToday] : '❔',
              label: interaction.partnerMoodToday ? t(moodTranslationKey(interaction.partnerMoodToday)) : t('home.moodNotSet'),
            })}
          </Text>
        </Pressable>

        <View style={styles.periodGrid}>
          {PERIOD_CARDS.map((c) => (
            <QuickActionCard
              key={c.period}
              label={t(c.tabKey)}
              icon={c.icon}
              onPress={() => navigation.navigate('Rewards', { period: c.period })}
              cardStyle={dark ? { backgroundColor: maleHomeDark.cardBg, borderColor: maleHomeDark.border } : undefined}
              iconWrapStyle={dark ? { backgroundColor: maleHomeDark.cardBgAlt } : undefined}
              labelStyle={dark ? { color: maleHomeDark.textPrimary } : undefined}
            />
          ))}
          <WishHomeCard
            label={t('winnings.cardLabel')}
            iconSource={SAVINGS_ICONS[role]}
            onPress={() => navigation.navigate('Savings')}
          />
          <WishHomeCard
            label={t('home.myWishes')}
            iconSource={wishlistIcons[role]}
            onPress={() => navigation.navigate('Wishlist', { owner: 'me' })}
          />
          <WishHomeCard
            label={t('home.partnerWishes')}
            iconSource={wishlistIcons[partnerRole]}
            onPress={() => navigation.navigate('Wishlist', { owner: 'partner' })}
          />
        </View>
      </ScrollView>

      <Modal visible={moodPickerOpen} transparent animationType="fade" onRequestClose={() => setMoodPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMoodPickerOpen(false)}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('checkin.title')}</Text>
            {MOOD_OPTIONS.map((mood) => (
              <Pressable
                key={mood}
                onPress={() => handlePickMood(mood)}
                style={[
                  styles.moodOption,
                  {
                    borderColor: interaction.myMoodToday === mood ? colors.primary : colors.border,
                    backgroundColor: interaction.myMoodToday === mood ? colors.background : 'transparent',
                    borderWidth: interaction.myMoodToday === mood ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.moodOptionEmoji}>{MOOD_EMOJI[mood]}</Text>
                <Text style={[styles.moodOptionLabel, { color: colors.text }]}>{t(moodTranslationKey(mood))}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      </ScreenContainer>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.sm,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingsButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rouletteHeaderIcon: {
    width: 34,
    height: 34,
  },
  balanceCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pairRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  pairPerson: {
    alignItems: 'center',
    flex: 1,
  },
  pairName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  pairPoints: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: 2,
  },
  balanceRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
    opacity: 0.9,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    width: '100%',
  },
  todayCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  todayProgress: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  todayStreak: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  todayMilestone: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  moodRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  moodLine: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  // Same numbers as QuickActionCard's own styles -- keeps all four cards in
  // the grid (2 period cards + these 2) pixel-identical in size and spacing.
  wishCard: {
    width: '47%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  wishIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  wishIconImage: {
    width: 50,
    height: 50,
  },
  wishLabel: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.3,
    fontWeight: '600',
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
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  moodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  moodOptionEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  moodOptionLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
