import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { Avatar } from '../../components/common/Avatar';
import { StatCard } from '../../components/cards/StatCard';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { NotificationPreferences } from '../../types';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { uploadProfilePhoto } from '../../services/supabase/photoService';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Plain-text-only building blocks for this screen -- no icons, no PNGs, no
// decorative circles (see the redesign request: a calm, minimal settings
// list). Local to this file on purpose, so the icon-based SettingsRow /
// SettingsSectionTitle (still used by PrivacyDataScreen/AboutScreen) stay
// untouched.
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SectionLabel = ({ label, color }: { label: string; color: string }) => (
  <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
);

const Row = ({
  label,
  value,
  onPress,
  isLast,
  textColor,
  mutedColor,
  borderColor,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}) => {
  const borderStyle = !isLast ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor } : null;
  const content = (
    <>
      <Text style={[styles.rowLabel, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {!!value && (
          <Text style={[styles.rowValue, { color: mutedColor }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {!!onPress && <Text style={[styles.chevron, { color: mutedColor }]}>{'›'}</Text>}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, borderStyle]}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, borderStyle, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
};

export const SettingsScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { userName, selectedAvatar, notificationPreferences, actions } = useAppStore();
  const { configured, session, profile, updateProfile, signOut } = useAuth();
  const sync = useCoupleSync();
  const { t } = useTranslation();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const cardBg = hexToRgba(colors.card, 0.72);
  const partnerRole = sync.partner?.role ?? (role === 'female' ? 'male' : 'female');
  const daysTogether = sync.couple ? Math.floor((Date.now() - new Date(sync.couple.created_at).getTime()) / 86400000) : null;
  const myId = session?.user?.id;

  // Tapping the avatar itself opens the picker -- works the same whether a
  // photo is already set (replaces it) or not (adds one for the first time).
  const handleChangePhoto = async () => {
    if (!myId || photoBusy) return;
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError(t('profile.photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    haptics.confirm();
    setPhotoBusy(true);
    try {
      const url = await uploadProfilePhoto(myId, result.assets[0].uri);
      await updateProfile({ photoUrl: url });
    } catch {
      setPhotoError(t('profile.photoUploadError'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const NOTIFICATION_ROWS: { key: keyof NotificationPreferences; label: string }[] = [
    { key: 'actions', label: t('settings.notifActions') },
    { key: 'rewardRequests', label: t('settings.notifRewardRequests') },
    { key: 'penalties', label: t('settings.notifPenalties') },
    { key: 'tasks', label: t('settings.notifTasks') },
    { key: 'goals', label: t('settings.notifGoals') },
    { key: 'achievements', label: t('settings.notifAchievements') },
  ];

  const pushConfigured = configured && !!session?.user && !!profile;
  const quietHoursEnabled = profile?.quiet_hours_start != null && profile?.quiet_hours_end != null;

  const toggleQuietHours = (value: boolean) => {
    updateProfile(value ? { quietHoursStart: 22, quietHoursEnd: 8 } : { quietHoursStart: null, quietHoursEnd: null });
  };

  const adjustQuietHour = (field: 'start' | 'end', delta: number) => {
    const current = field === 'start' ? profile?.quiet_hours_start : profile?.quiet_hours_end;
    if (current == null) return;
    const next = (current + delta + 24) % 24;
    updateProfile(field === 'start' ? { quietHoursStart: next } : { quietHoursEnd: next });
  };

  const handleSignOut = async () => {
    haptics.confirm();
    setConfirmSignOut(false);
    await signOut();
    // Auth is required to reach Main -- send the user back through Splash,
    // which will now correctly route to Welcome.
    // Settings now lives inside the bottom tab navigator -- `reset` must
    // target the root stack explicitly (it doesn't bubble up like `navigate`
    // does), otherwise it would try to reset the TAB navigator to a
    // nonexistent 'Splash' tab instead of the whole app.
    navigation.getParent<NativeStackScreenProps<RootStackParamList>['navigation']>()?.reset({
      index: 0,
      routes: [{ name: 'Splash' }],
    });
  };

  const rowProps = { textColor: colors.text, mutedColor: colors.textSecondary, borderColor: colors.border };

  return (
    <ScreenBackground>
    <ScreenContainer inTabBar transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('settings.title')} />

        <Pressable onPress={handleChangePhoto} disabled={photoBusy} style={styles.photoArea}>
          <Avatar role={role} avatarId={selectedAvatar} photoUrl={profile?.photo_url} size={96} selected />
          {photoBusy && (
            <View style={styles.photoBusyOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </Pressable>
        {!!photoError && <Text style={[styles.photoError, { color: colors.danger }]}>{photoError}</Text>}
        <Text style={[styles.profileUserName, { color: colors.text }]}>{userName}</Text>

        <View style={[styles.partnerCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} photoUrl={sync.partner?.photo_url} size={56} />
          <View style={styles.partnerInfo}>
            <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>
              {sync.partner?.name ?? t('profile.notConnected')}
            </Text>
            <Text style={[styles.partnerStatus, { color: colors.textSecondary }]}>
              {sync.couple
                ? daysTogether === null || daysTogether === 0
                  ? t('profile.togetherToday')
                  : t('profile.together', { days: daysTogether })
                : t('profile.notConnected')}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate('Finance')} style={styles.statsRow}>
          <StatCard label={t('profile.points')} value={sync.myStats.balance} emphasis />
          <StatCard label={t('profile.earned')} value={sync.myStats.earned} />
          <StatCard label={t('profile.spent')} value={sync.myStats.spent} />
        </Pressable>

        <SectionLabel label={t('settings.profile')} color={colors.textSecondary} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Row label={t('settings.history')} onPress={() => navigation.navigate('History')} {...rowProps} />
          <Row label={t('settings.couple')} onPress={() => navigation.navigate('CoupleProfile')} isLast {...rowProps} />
        </View>

        <SectionLabel label={t('settings.sectionApp')} color={colors.textSecondary} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.notificationsCard')}</Text>
          {NOTIFICATION_ROWS.map((row, i) => (
            <View
              key={row.key}
              style={[
                styles.switchRow,
                i < NOTIFICATION_ROWS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.switchLabel, { color: colors.text }]}>{row.label}</Text>
              <Switch
                value={notificationPreferences[row.key]}
                onValueChange={(value) => actions.setNotificationPreference(row.key, value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.pushCard')}</Text>
          {!pushConfigured ? (
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{t('settings.pushSubtitleNoBackend')}</Text>
          ) : (
            <>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>{t('settings.pushEnabled')}</Text>
                <Switch
                  value={profile?.push_enabled ?? true}
                  onValueChange={(value) => updateProfile({ pushEnabled: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text style={[styles.quietHoursTitle, { color: colors.textSecondary }]}>{t('settings.quietHours')}</Text>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>{t('settings.quietHoursEnable')}</Text>
                <Switch
                  value={quietHoursEnabled}
                  onValueChange={toggleQuietHours}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {quietHoursEnabled && (
                <View style={styles.quietHoursRow}>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => adjustQuietHour('start', -1)} hitSlop={8} style={styles.stepperButton}>
                      <Text style={[styles.stepperText, { color: colors.primary }]}>{'−'}</Text>
                    </Pressable>
                    <Text style={[styles.quietHoursText, { color: colors.text }]}>
                      {String(profile?.quiet_hours_start ?? 22).padStart(2, '0')}:00
                    </Text>
                    <Pressable onPress={() => adjustQuietHour('start', 1)} hitSlop={8} style={styles.stepperButton}>
                      <Text style={[styles.stepperText, { color: colors.primary }]}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.quietHoursText, { color: colors.textSecondary }]}> — </Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => adjustQuietHour('end', -1)} hitSlop={8} style={styles.stepperButton}>
                      <Text style={[styles.stepperText, { color: colors.primary }]}>{'−'}</Text>
                    </Pressable>
                    <Text style={[styles.quietHoursText, { color: colors.text }]}>
                      {String(profile?.quiet_hours_end ?? 8).padStart(2, '0')}:00
                    </Text>
                    <Pressable onPress={() => adjustQuietHour('end', 1)} hitSlop={8} style={styles.stepperButton}>
                      <Text style={[styles.stepperText, { color: colors.primary }]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {quietHoursEnabled && (
                <Text
                  accessibilityLabel={t('settings.quietHoursRange', {
                    start: String(profile?.quiet_hours_start ?? 22),
                    end: String(profile?.quiet_hours_end ?? 8),
                  })}
                  style={[styles.rowSubtitle, styles.quietHoursSummary, { color: colors.textSecondary }]}
                >
                  {t('settings.quietHoursRange', {
                    start: String(profile?.quiet_hours_start ?? 22),
                    end: String(profile?.quiet_hours_end ?? 8),
                  })}
                </Text>
              )}
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Row
            label={t('settings.language')}
            onPress={() => navigation.navigate('Language', { mode: 'settings' })}
            {...rowProps}
          />
          <Row
            label={t('settings.theme')}
            value={role === 'female' ? t('settings.themePink') : t('settings.themeBlue')}
            isLast
            {...rowProps}
          />
        </View>

        <SectionLabel label={t('settings.sectionPrivacyAccount')} color={colors.textSecondary} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Row label={t('settings.privacyDataHub')} onPress={() => navigation.navigate('PrivacyData')} {...rowProps} />
          <Row label={t('settings.accountSync')} onPress={() => navigation.navigate('Account')} isLast {...rowProps} />
        </View>

        <SectionLabel label={t('settings.sectionAbout')} color={colors.textSecondary} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Row label={t('settings.tutorial')} onPress={() => navigation.navigate('Tutorial', { manual: true })} {...rowProps} />
          <Row label={t('settings.aboutCoupleUp')} onPress={() => navigation.navigate('About')} isLast {...rowProps} />
        </View>

        <PrimaryButton label="Выйти" onPress={() => setConfirmSignOut(true)} variant="outline" style={styles.signOutButton} />
      </ScrollView>

      <ConfirmationModal
        visible={confirmSignOut}
        title="Выйти из аккаунта?"
        message="Локальные данные на этом устройстве останутся без изменений — выходит только облачная сессия."
        confirmLabel="Выйти"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  photoArea: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  photoBusyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoError: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  profileUserName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  partnerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  partnerName: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  partnerStatus: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    fontSize: fontSize.sm,
  },
  chevron: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  rowSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    paddingBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  quietHoursTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: spacing.sm,
  },
  quietHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  quietHoursText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginHorizontal: spacing.xs,
  },
  quietHoursSummary: {
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
