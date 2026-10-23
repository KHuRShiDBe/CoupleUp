import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList } from '../../navigation/types';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { iconColors } from '../../theme/iconColors';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { Avatar } from '../../components/common/Avatar';
import { IconImage } from '../../components/common/IconImage';
import { Badge } from '../../components/common/Badge';
import { QuickActionCard } from '../../components/cards/QuickActionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useCoupleInteraction } from '../../store/CoupleInteractionContext';
import { useNotifications } from '../../store/NotificationsContext';
import { useQuests } from '../../store/QuestsContext';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';
import { MOOD_OPTIONS, MOOD_EMOJI, moodTranslationKey } from '../../utils/mood';
import { computeQuestProgress } from '../../utils/questProgress';
import { getPeriodKey } from '../../constants/questSelection';
import { MoodValue } from '../../types/database';
import { QuestPeriod } from '../../types/database';
import { IconName } from '../../types';

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

// One shared look for every action card on this screen (period card,
// savings, both wishlist cards, roulette, agreements) -- same height,
// border radius/width, padding, icon size, title size, centered icon+text,
// same shadow. Passed as overrides into QuickActionCard's own cardStyle/
// iconWrapStyle/labelStyle props (that component's base style already gives
// everything else -- radius, border, padding, shadow -- for free); nothing
// here is a per-card bespoke style.
// marginBottom: 0 cancels QuickActionCard's own built-in marginBottom --
// row spacing on Home is controlled entirely by the grid container's
// rowGap below, so every row (not just some) gets the exact same gap.
const HOME_CARD_STYLE = { height: 128, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 0 };
const HOME_CARD_ICON_WRAP_STYLE = { alignItems: 'center' as const, marginBottom: spacing.sm };
const HOME_CARD_LABEL_STYLE = { textAlign: 'center' as const };

export const HomeScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const loading = useMockLoading();
  const { userName, selectedAvatar } = useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  const bond = useBond();
  const interaction = useCoupleInteraction();
  const { unreadCount } = useNotifications();
  const quests = useQuests();
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  // Tap-to-toggle display unit for each balance -- BOND is the default,
  // points is the same balance shown via the existing bond rate (no new
  // data, no recompute of the ledger itself). Independent per person so
  // toggling mine doesn't affect the partner's display.
  const [myBalanceUnit, setMyBalanceUnit] = useState<'bond' | 'points'>('bond');
  const [partnerBalanceUnit, setPartnerBalanceUnit] = useState<'bond' | 'points'>('bond');

  const partnerRole = sync.partner?.role ?? (role === 'male' ? 'female' : 'male');
  const coupleId = sync.couple?.id ?? null;
  const myId = auth.session?.user?.id ?? '';

  // Real today's daily-quest completion for the CURRENT user only -- same
  // done/total definition RewardsScreen uses for whoever's signed in. A
  // person's own quests are drawn from the OTHER role's themed pool (see
  // questSelection.ts), so "my" pool uses partnerRole, not my own role.
  const dailyPeriodKey = getPeriodKey('daily');
  const myDailyProgress = computeQuestProgress({
    period: 'daily',
    periodKey: dailyPeriodKey,
    coupleId: coupleId ?? '',
    poolRole: partnerRole,
    userId: myId,
    progress: quests.progress,
    customItems: quests.customItems,
    hiddenItems: quests.hiddenItems,
  });

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
      {/* Edge-to-edge hero panel -- sits outside ScreenContainer's padded
          content area so it spans full width and touches the top of the
          screen (only the safe-area inset is reserved, via paddingTop, so it
          doesn't sit under the status bar/notch). Not a floating card: no
          margin, no border radius, no shadow. */}
      <View style={[styles.heroSection, { paddingTop: insets.top + spacing.md, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
          style={[styles.notificationButton, { top: insets.top + spacing.sm }]}
        >
          <IconImage name="notification" size={24} color={iconColors[role].primary} />
          {!!unreadCount && <Badge count={unreadCount} />}
        </Pressable>
        <View style={styles.pairRow}>
          <View style={styles.pairPerson}>
            <Avatar role={role} avatarId={selectedAvatar} photoUrl={auth.profile?.photo_url} size={48} />
            <Text style={[styles.pairName, { color: colors.text }]} numberOfLines={1}>
              {userName}
            </Text>
            <Pressable onPress={() => setMyBalanceUnit((u) => (u === 'bond' ? 'points' : 'bond'))} hitSlop={6}>
              <Text style={[styles.pairPoints, { color: colors.primary }]}>
                {myBalanceUnit === 'bond'
                  ? t('home.bondSuffix', { bond: formatBond(bond.toBond(sync.myStats.balance)) })
                  : t('home.pointsSuffix', { points: sync.myStats.balance })}
              </Text>
            </Pressable>
            <Pressable onPress={() => setMoodPickerOpen(true)} hitSlop={6}>
              <Text style={[styles.pairMood, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('home.moodLabel', {
                  emoji: interaction.myMood ? MOOD_EMOJI[interaction.myMood] : '❔',
                  label: interaction.myMood ? t(moodTranslationKey(interaction.myMood)) : t('home.moodNotSet'),
                })}
              </Text>
            </Pressable>
          </View>
          <View style={styles.pairPerson}>
            <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} photoUrl={sync.partner?.photo_url} size={48} />
            <Text style={[styles.pairName, { color: colors.text }]} numberOfLines={1}>
              {sync.partner?.name ?? t('home.notConnected')}
            </Text>
            <Pressable onPress={() => setPartnerBalanceUnit((u) => (u === 'bond' ? 'points' : 'bond'))} hitSlop={6}>
              <Text style={[styles.pairPoints, { color: colors.primary }]}>
                {partnerBalanceUnit === 'bond'
                  ? t('home.bondSuffix', { bond: formatBond(bond.toBond(sync.partnerStats.balance)) })
                  : t('home.pointsSuffix', { points: sync.partnerStats.balance })}
              </Text>
            </Pressable>
            <Text style={[styles.pairMood, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('home.moodLabel', {
                emoji: interaction.partnerMood ? MOOD_EMOJI[interaction.partnerMood] : '❔',
                label: interaction.partnerMood ? t(moodTranslationKey(interaction.partnerMood)) : t('home.moodNotSet'),
              })}
            </Text>
          </View>
        </View>
      </View>

      <ScreenContainer inTabBar transparent style={styles.mainContent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.cardGrid}>
          {PERIOD_CARDS.map((c) => (
            <QuickActionCard
              key={c.period}
              label={t(c.tabKey)}
              icon={c.icon}
              onPress={() => navigation.navigate('Rewards', { period: c.period })}
              cardStyle={HOME_CARD_STYLE}
              iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
              labelStyle={HOME_CARD_LABEL_STYLE}
              topLeftContent={
                c.period === 'daily' ? (
                  <Text style={[styles.dailyProgressLine, { color: colors.textSecondary }]} numberOfLines={1}>
                    {myDailyProgress.done} из {myDailyProgress.total}
                  </Text>
                ) : undefined
              }
            />
          ))}
          <QuickActionCard
            label={t('winnings.cardLabel')}
            icon="savings"
            onPress={() => navigation.navigate('Savings')}
            cardStyle={HOME_CARD_STYLE}
            iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
            labelStyle={HOME_CARD_LABEL_STYLE}
          />
          <QuickActionCard
            label={t('home.myWishes')}
            icon="wishlist"
            // Heart tint only, colored by the WISHLIST OWNER's own role --
            // card background/border stay the same as every other card,
            // only the icon color is owner-specific.
            iconColor={iconColors[role].primary}
            onPress={() => navigation.navigate('Wishlist', { owner: 'me' })}
            cardStyle={HOME_CARD_STYLE}
            iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
            labelStyle={HOME_CARD_LABEL_STYLE}
          />
          <QuickActionCard
            label={t('home.partnerWishes')}
            icon="partnerWishlist"
            iconColor={iconColors[partnerRole].primary}
            onPress={() => navigation.navigate('Wishlist', { owner: 'partner' })}
            cardStyle={HOME_CARD_STYLE}
            iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
            labelStyle={HOME_CARD_LABEL_STYLE}
          />
          <QuickActionCard
            label={t('roulette.hubTitle')}
            icon="roulette"
            onPress={() => navigation.navigate('RouletteHub')}
            cardStyle={HOME_CARD_STYLE}
            iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
            labelStyle={HOME_CARD_LABEL_STYLE}
          />
          <QuickActionCard
            label={t('home.agreementsTitle')}
            icon="tasks"
            onPress={() => navigation.navigate('Add')}
            cardStyle={HOME_CARD_STYLE}
            iconWrapStyle={HOME_CARD_ICON_WRAP_STYLE}
            labelStyle={HOME_CARD_LABEL_STYLE}
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
                    borderColor: interaction.myMood === mood ? colors.primary : colors.border,
                    backgroundColor: interaction.myMood === mood ? colors.background : 'transparent',
                    borderWidth: interaction.myMood === mood ? 2 : 1,
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
    // Same gap below the last card row as between the rows themselves
    // (cardGrid's rowGap) -- so the bottom tab bar isn't set apart by a
    // bigger gap than the rows have between each other.
    paddingBottom: spacing.md,
  },
  heroSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  notificationButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  mainContent: {
    // ScreenContainer's own top inset is already consumed by heroSection
    // above (which reserves it itself) -- only a small breathing gap is
    // needed here, not the full safe-area inset again.
    paddingTop: spacing.md,
  },
  pairRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  pairMood: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Single grid for every Home action card (period, savings, both wishlist
  // cards, roulette, agreements) -- one 2-column layout, one rowGap for every
  // row, no per-card/per-row margins. Columns stay evenly split via
  // space-between (every card shares the same fixed width), so the
  // horizontal gap is just as uniform as the vertical one.
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  dailyProgressLine: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: fontSize.xs * 1.3,
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
