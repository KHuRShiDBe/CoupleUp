import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SettingsRow, SettingsSectionTitle } from '../../components/common/SettingsRow';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { NotificationPreferences } from '../../types';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { notificationPreferences, actions } = useAppStore();
  const { configured, session, profile, updateProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />

        <SettingsSectionTitle label={t('settings.profile')} />
        <SettingsRow icon="profile" label={t('settings.profile')} onPress={() => navigation.navigate('Profile')} />
        <SettingsRow icon="history" label={t('settings.history')} onPress={() => navigation.navigate('History')} />
        <SettingsRow icon="pair" label={t('settings.couple')} onPress={() => navigation.navigate('CoupleProfile')} />

        <SettingsSectionTitle label={t('settings.sectionApp')} />
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.notificationsCard')}</Text>
          {NOTIFICATION_ROWS.map((row) => (
            <View key={row.key} style={styles.switchRow}>
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
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                      <Text style={[styles.stepperText, { color: colors.primary }]}>−</Text>
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
                      <Text style={[styles.stepperText, { color: colors.primary }]}>−</Text>
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
        <SettingsRow icon="message" label={t('settings.language')} onPress={() => navigation.navigate('Language', { mode: 'settings' })} />
        <SettingsRow icon="settings" label={t('settings.theme')} subtitle={role === 'female' ? t('settings.themePink') : t('settings.themeBlue')} />

        <SettingsSectionTitle label={t('settings.sectionPrivacyAccount')} />
        <SettingsRow
          icon="lock"
          label={t('settings.privacyDataHub')}
          subtitle={t('settings.privacyDataHubSubtitle')}
          onPress={() => navigation.navigate('PrivacyData')}
        />
        <SettingsRow
          icon="pair"
          label={t('settings.accountSync')}
          subtitle={t('settings.accountSyncSubtitle')}
          onPress={() => navigation.navigate('Account')}
        />

        <SettingsRow icon="notification" label={t('settings.sectionAbout')} onPress={() => navigation.navigate('About')} />
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  rowSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
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
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
