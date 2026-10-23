import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { getNotificationPermissionStatusAsync } from '../../services/notifications/pushService';

type Props = NativeStackScreenProps<RootStackParamList, 'DataPermissions'>;

type Status = 'granted' | 'denied' | 'undetermined' | 'checking';

const STATUS_LABEL: Record<Status, string> = {
  granted: 'Разрешено',
  denied: 'Запрещено',
  undetermined: 'Не запрошено',
  checking: 'Проверка…',
};

// Only shows permissions the app can actually request today (Notifications).
// Photos/Camera are deliberately NOT requested here or anywhere else in the
// app -- per spec, a permission is only asked for at the moment a feature
// that needs it is actually used, and no such feature exists yet.
export const DataPermissionsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [notifStatus, setNotifStatus] = useState<Status>('checking');

  useEffect(() => {
    getNotificationPermissionStatusAsync()
      .then(setNotifStatus)
      .catch(() => setNotifStatus('undetermined'));
  }, []);

  const statusColor = (status: Status) => {
    if (status === 'granted') return colors.success;
    if (status === 'denied') return colors.danger;
    return colors.textSecondary;
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title="Данные и разрешения" onBack={() => navigation.goBack()} />
      <View style={styles.list}>
        <View style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Уведомления</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Нужны для push и локальных напоминаний о событиях пары
            </Text>
          </View>
          <Text style={[styles.status, { color: statusColor(notifStatus) }]}>{STATUS_LABEL[notifStatus]}</Text>
        </View>

        <View style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Локальное хранилище</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Приложение хранит настройки и (пока нет облачного аккаунта) данные прямо на устройстве — отдельного
              разрешения ОС для этого не требуется
            </Text>
          </View>
          <Text style={[styles.status, { color: colors.success }]}>Всегда доступно</Text>
        </View>

        <View style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Доступ к сети</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Используется только для синхронизации с облачным аккаунтом, если вы его подключили
            </Text>
          </View>
          <Text style={[styles.status, { color: colors.success }]}>Всегда доступно</Text>
        </View>
      </View>

      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Camera и Photos приложением не запрашиваются — они появятся здесь только если и когда в CoupleUp добавится
        функция, которой они реально нужны (например, загрузка своей фотографии вместо аватара).
      </Text>

      <PrimaryButton label="Открыть настройки приложения" onPress={() => Linking.openSettings()} variant="outline" />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  list: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  status: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  note: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
