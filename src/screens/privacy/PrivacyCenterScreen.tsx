import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import * as dataExportService from '../../services/supabase/dataExportService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyCenter'>;

const STORED_ITEMS = [
  'Профиль — имя, роль, аватар, язык',
  'Данные пары — код, состав, общие баллы и их история',
  'Действия, задания, награды, штрафы — журнал пары',
  'Привычки, обещания, планы, цели, бюджет и покупки пары',
  'Сообщения запросов (награды, покупки) внутри пары',
  'Другие данные функций CoupleUp, привязанные к вашей паре',
];

export const PrivacyCenterScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useCoupleSync();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!auth.session?.user?.id || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const data = await dataExportService.exportMyData(auth.session.user.id, sync.couple?.id ?? null);
      const json = JSON.stringify(data, null, 2);
      const fileUri = `${FileSystem.cacheDirectory}coupleup-my-data-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Мои данные CoupleUp' });
      }
      haptics.success();
    } catch (e) {
      haptics.error();
      setExportError(friendlyMessage(toServiceError(e)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Центр приватности" onBack={() => navigation.goBack()} />

        <Text style={[styles.intro, { color: colors.textSecondary }]}>Что CoupleUp хранит о вас, простыми словами:</Text>

        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {STORED_ITEMS.map((item) => (
            <View key={item} style={styles.itemRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.itemText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Мы никогда не храним пароли или ключи доступа в открытом виде, и никто, кроме вас и вашего партнёра по паре,
          не видит эти данные — это защищено на уровне базы данных, а не только интерфейсом приложения.
        </Text>

        <PrimaryButton label="Export my data" onPress={handleExport} loading={exporting} variant="outline" style={styles.actionButton} />
        {exportError && <Text style={[styles.errorText, { color: colors.danger }]}>{exportError}</Text>}
        {!exporting && (
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Выгружается JSON-файл со всеми данными, к которым у вас есть доступ (ваш профиль и данные вашей пары).
            Секретные ключи, токены входа и данные чужих пар в файл никогда не попадают.
          </Text>
        )}

        <PrimaryButton
          label="Delete my account"
          onPress={() => navigation.navigate('DeleteAccount')}
          variant="outline"
          colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
          style={styles.actionButton}
        />
        {exporting && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  intro: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: spacing.sm,
  },
  itemText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    flex: 1,
  },
  note: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  center: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
