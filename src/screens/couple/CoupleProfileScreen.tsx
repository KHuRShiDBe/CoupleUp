import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Avatar } from '../../components/common/Avatar';
import { IconImage } from '../../components/common/IconImage';
import { StatCard } from '../../components/cards/StatCard';
import { ActionListItem } from '../../components/cards/ActionListItem';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useAppStore } from '../../store/AppContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useCoupleStats } from '../../store/useCoupleStats';
import { DECORATIONS } from '../../constants/decorations';
import { toActionHistoryItem } from '../../utils/actionDisplay';
import { formatBond, formatUsd } from '../../utils/bond';
import { isThisMonth } from '../../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleProfile'>;

export const CoupleProfileScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { userName, selectedAvatar, selectedDecoration } = useAppStore();
  const sync = useCoupleSync();
  const bond = useBond();
  const stats = useCoupleStats();
  const { level: coupleLevel, currentStreak: coupleStreak, bestStreak: bestCoupleStreak } = stats;
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmDisconnectFinal, setConfirmDisconnectFinal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const partnerRole = sync.partner?.role ?? (role === 'male' ? 'female' : 'male');
  const daysTogether = sync.couple ? Math.floor((Date.now() - new Date(sync.couple.created_at).getTime()) / 86400000) : null;
  // Real `goals` table (Package #2) instead of the legacy local sharedGoals
  // array -- this used to show a goal that could disappear/diverge from what
  // SharedGoalsScreen itself now displays.
  const primaryGoal = sync.goals.find((g) => g.current_points < g.target_points) ?? sync.goals[0];
  const monthActions = sync.actionsList.filter((a) => isThisMonth(a.created_at));
  const monthEarned = monthActions.filter((a) => a.points > 0).reduce((sum, a) => sum + a.points, 0);
  const monthSpent = monthActions.filter((a) => a.points < 0).reduce((sum, a) => sum + Math.abs(a.points), 0);
  const recentActions = sync.actionsList
    .slice(0, 3)
    .map((a) =>
      toActionHistoryItem(a, {
        myId: sync.userId ?? '',
        myRole: role,
        myAvatar: selectedAvatar,
        myName: userName,
        partner: sync.partner,
        partnerFallbackName: 'Не связан',
      }),
    );
  const deco = DECORATIONS[selectedDecoration];
  const ringColor = deco.avatarRingColor ?? colors.primary;
  const cardBorderColor = deco.cardBorderColor ?? colors.border;

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Профиль пары" onBack={() => navigation.goBack()} />

        <View
          style={[
            styles.pairCard,
            shadow.soft,
            {
              backgroundColor: colors.card,
              borderColor: cardBorderColor,
              borderWidth: deco.cardBorderWidth,
              borderStyle: deco.cardBorderStyle,
            },
          ]}
        >
          {deco.badgeLabel && (
            <View style={[styles.decoBadge, { borderColor: cardBorderColor, backgroundColor: colors.background }]}>
              <Text style={[styles.decoBadgeText, { color: cardBorderColor }]}>{deco.badgeLabel}</Text>
            </View>
          )}
          <View style={styles.pairPerson}>
            <View
              style={[
                styles.avatarRing,
                { borderColor: ringColor, borderWidth: deco.avatarRingWidth, borderStyle: deco.avatarRingStyle },
              ]}
            >
              <Avatar role={role} avatarId={selectedAvatar} size={80} selected />
            </View>
            <Text style={[styles.pairName, { color: colors.text }]} numberOfLines={1}>
              {userName}
            </Text>
          </View>
          <View style={[styles.pairDivider, { backgroundColor: colors.background }]}>
            <IconImage name="pair" size={22} />
          </View>
          <View style={styles.pairPerson}>
            <View
              style={[
                styles.avatarRing,
                { borderColor: ringColor, borderWidth: deco.avatarRingWidth, borderStyle: deco.avatarRingStyle },
              ]}
            >
              <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} size={80} />
            </View>
            <Text style={[styles.pairName, { color: colors.text }]} numberOfLines={1}>
              {sync.partner?.name ?? 'Не связан'}
            </Text>
          </View>
        </View>

        <View style={styles.togetherWrap}>
          {!!sync.couple && (
            <Text style={[styles.together, { color: colors.text }]}>
              {daysTogether === null || daysTogether === 0 ? 'Вы подключились сегодня' : `${daysTogether} дней вместе`}
            </Text>
          )}
        </View>

        <View style={[styles.statsCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Статистика пары</Text>

          <View style={styles.personStatsBlock}>
            <View style={styles.personStatsHeader}>
              <Avatar role={role} avatarId={selectedAvatar} size={32} />
              <Text style={[styles.personStatsName, { color: colors.text }]} numberOfLines={1}>
                {userName}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Баланс" value={sync.myStats.balance} emphasis />
              <StatCard label="Заработано" value={sync.myStats.earned} />
              <StatCard label="Потрачено" value={sync.myStats.spent} />
            </View>
            <Text style={[styles.bondEquivalent, { color: colors.textSecondary }]}>
              ≈ {formatBond(bond.toBond(sync.myStats.balance))} BOND · ≈ {formatUsd(bond.toBond(sync.myStats.balance))}
            </Text>
          </View>

          <View style={styles.personStatsBlock}>
            <View style={styles.personStatsHeader}>
              <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} size={32} />
              <Text style={[styles.personStatsName, { color: colors.text }]} numberOfLines={1}>
                {sync.partner?.name ?? 'Не связан'}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Баланс" value={sync.partnerStats.balance} emphasis />
              <StatCard label="Заработано" value={sync.partnerStats.earned} />
              <StatCard label="Потрачено" value={sync.partnerStats.spent} />
            </View>
            <Text style={[styles.bondEquivalent, { color: colors.textSecondary }]}>
              ≈ {formatBond(bond.toBond(sync.partnerStats.balance))} BOND · ≈ {formatUsd(bond.toBond(sync.partnerStats.balance))}
            </Text>
          </View>

          <View style={[styles.coupleTotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.coupleTotalLabel, { color: colors.textSecondary }]}>Общий баланс пары</Text>
            <Text style={[styles.coupleTotalValue, { color: colors.primary }]}>{sync.couple?.points ?? 0}</Text>
            <Text style={[styles.bondEquivalent, { color: colors.textSecondary }]}>
              ≈ {formatBond(bond.toBond(sync.couple?.points ?? 0))} BOND · ≈ {formatUsd(bond.toBond(sync.couple?.points ?? 0))}
            </Text>
          </View>
        </View>

        <View style={[styles.streakCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Экономика пары</Text>
          <View style={styles.statsRow}>
            <StatCard label="Мои баллы" value={sync.myStats.balance} />
            <StatCard label="Баллы партнёра" value={sync.partnerStats.balance} />
            <StatCard label="Общий баланс" value={sync.couple?.points ?? 0} emphasis />
          </View>
          <Text style={[styles.bondEquivalent, { color: colors.textSecondary }]}>
            ≈ {formatBond(bond.toBond(sync.couple?.points ?? 0))} BOND · ≈ {formatUsd(bond.toBond(sync.couple?.points ?? 0))}
          </Text>
          <View style={[styles.monthlyRow, { borderTopColor: colors.border }]}>
            <View style={styles.monthlyItem}>
              <Text style={[styles.monthlyValue, { color: colors.success }]}>+{monthEarned}</Text>
              <Text style={[styles.monthlyLabel, { color: colors.textSecondary }]}>Заработано за месяц</Text>
            </View>
            <View style={styles.monthlyItem}>
              <Text style={[styles.monthlyValue, { color: colors.danger }]}>-{monthSpent}</Text>
              <Text style={[styles.monthlyLabel, { color: colors.textSecondary }]}>Потрачено за месяц</Text>
            </View>
          </View>
        </View>

        <View style={[styles.streakCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.levelHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Уровень пары: {coupleLevel.level}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${coupleLevel.progress * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.levelMeta, { color: colors.textSecondary }]}>
            {coupleLevel.nextThreshold
              ? `Прогресс: ${coupleLevel.currentPoints} / ${coupleLevel.nextThreshold} XP`
              : `Прогресс: ${coupleLevel.currentPoints} XP · максимальный уровень`}
          </Text>
        </View>

        <View style={[styles.streakCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Streak пары</Text>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={[styles.streakValue, { color: colors.primary }]}>{coupleStreak}</Text>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Текущий streak</Text>
            </View>
            <View style={styles.streakItem}>
              <Text style={[styles.streakValue, { color: colors.text }]}>{bestCoupleStreak}</Text>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Лучший streak</Text>
            </View>
          </View>
        </View>

        {primaryGoal && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Общая цель</Text>
            <View style={[styles.goalCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.goalTitle, { color: colors.text }]}>{primaryGoal.title}</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${Math.min(100, (primaryGoal.current_points / primaryGoal.target_points) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.goalMeta, { color: colors.textSecondary }]}>
                {primaryGoal.current_points} / {primaryGoal.target_points} баллов
              </Text>
            </View>
          </View>
        )}

        {recentActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Последние действия пары</Text>
            {recentActions.map((item) => (
              <ActionListItem key={item.id} item={item} />
            ))}
          </View>
        )}

        <PrimaryButton
          label="Wishlist"
          onPress={() => navigation.navigate('Wishlist')}
          variant="outline"
          style={styles.settingsButton}
        />
        <PrimaryButton
          label="Итоги месяца"
          onPress={() => navigation.navigate('MonthlySummary')}
          variant="outline"
          style={styles.settingsButton}
        />
        <PrimaryButton
          label="Итоги недели"
          onPress={() => navigation.navigate('WeeklyCoupleSummary')}
          variant="outline"
          style={styles.settingsButton}
        />
        <PrimaryButton
          label="Статистика пары"
          onPress={() => navigation.navigate('CoupleStats')}
          variant="outline"
          style={styles.settingsButton}
        />
        <PrimaryButton
          label="Настройки пары"
          icon="settings"
          onPress={() => navigation.navigate('Main', { screen: 'Settings' })}
          variant="outline"
          style={styles.settingsButton}
        />

        {!!sync.couple && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Управление парой</Text>
            <View style={[styles.goalCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.manageRow}>
                <Text style={[styles.manageLabel, { color: colors.textSecondary }]}>Партнёр</Text>
                <Text style={[styles.manageValue, { color: colors.text }]}>{sync.partner?.name ?? 'Ожидание партнёра'}</Text>
              </View>
              <View style={styles.manageRow}>
                <Text style={[styles.manageLabel, { color: colors.textSecondary }]}>Дата подключения</Text>
                <Text style={[styles.manageValue, { color: colors.text }]}>
                  {new Date(sync.couple.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.manageRow}>
                <Text style={[styles.manageLabel, { color: colors.textSecondary }]}>Статус</Text>
                <Text style={[styles.manageValue, { color: sync.partner ? colors.success : colors.textSecondary }]}>
                  {sync.partner ? 'Активна' : 'Ожидание партнёра'}
                </Text>
              </View>
            </View>
            <PrimaryButton
              label="Отключить пару"
              onPress={() => setConfirmDisconnect(true)}
              variant="outline"
              colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
              style={styles.settingsButton}
            />
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={confirmDisconnect}
        title="Отключить пару?"
        message="Пара будет полностью разорвана для обеих сторон: старый код приглашения станет недействительным, и вы с партнёром больше не будете видеть новые действия и данные друг друга. Общая история за прошлое останется у каждого. Это можно отменить только заново создав пару."
        confirmLabel="Продолжить"
        danger
        onConfirm={() => {
          setConfirmDisconnect(false);
          setConfirmDisconnectFinal(true);
        }}
        onCancel={() => setConfirmDisconnect(false)}
      />

      <ConfirmationModal
        visible={confirmDisconnectFinal}
        title="Точно отключить?"
        message="Это последнее подтверждение. Пара будет отключена немедленно для вас и для партнёра."
        confirmLabel="Отключить пару"
        danger
        onConfirm={async () => {
          if (leaving) return;
          setLeaving(true);
          const ok = await sync.leaveCouple();
          setLeaving(false);
          setConfirmDisconnectFinal(false);
          // Pairing is required for Main -- send the user back through Splash,
          // which will now correctly route to ConnectPartner.
          if (ok) navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
        }}
        onCancel={() => setConfirmDisconnectFinal(false)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  pairCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  decoBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  decoBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  avatarRing: {
    borderRadius: 46,
    padding: 3,
  },
  pairPerson: {
    alignItems: 'center',
    flex: 1,
  },
  pairName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  pairDivider: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togetherWrap: {
    marginBottom: spacing.lg,
  },
  together: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statsCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  personStatsBlock: {
    marginTop: spacing.md,
  },
  bondEquivalent: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  monthlyRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  monthlyItem: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  monthlyLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  personStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  personStatsName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flexShrink: 1,
  },
  coupleTotalRow: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  coupleTotalLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  coupleTotalValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  streakCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  levelBadge: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  levelMeta: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  streakRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  goalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  goalTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  goalMeta: {
    fontSize: fontSize.xs,
  },
  settingsButton: {
    marginTop: spacing.sm,
  },
  manageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  manageLabel: {
    fontSize: fontSize.sm,
  },
  manageValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
