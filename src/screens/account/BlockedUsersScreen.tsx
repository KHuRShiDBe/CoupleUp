import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import * as blockedUsersService from '../../services/supabase/blockedUsersService';
import { BlockedUserRow } from '../../services/supabase/blockedUsersService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export const BlockedUsersScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { configured, session } = useAuth();
  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!configured || !session?.user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await blockedUsersService.listBlockedUsers());
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, session?.user?.id]);

  const handleUnblock = async (blockedUserId: string) => {
    try {
      await blockedUsersService.unblockUser(blockedUserId);
      haptics.success();
      setRows((prev) => prev.filter((r) => r.blocked_user_id !== blockedUserId));
    } catch (e) {
      haptics.error();
      setError(friendlyMessage(toServiceError(e)));
    }
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title="Заблокированные пользователи" onBack={() => navigation.goBack()} />

      {!configured || !session?.user ? (
        <ErrorState
          title="Нужен облачный аккаунт"
          message="Блокировка доступна после подключения аккаунта и синхронизации (Настройки → Аккаунт и синхронизация)."
        />
      ) : (
        <>
          {error && <ErrorState message={error} onRetry={load} />}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="lock"
              title="Заблокированных нет"
              description="Заблокировать партнёра можно из экрана «Аккаунт и синхронизация»"
            />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(row) => row.blocked_user_id}
              renderItem={({ item }) => (
                <View style={[styles.row, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.rowId, { color: colors.text }]} numberOfLines={1}>
                    ID: {item.blocked_user_id.slice(0, 8)}…
                  </Text>
                  <PrimaryButton
                    label="Разблокировать"
                    onPress={() => handleUnblock(item.blocked_user_id)}
                    variant="outline"
                    style={styles.unblockButton}
                  />
                </View>
              )}
            />
          )}
        </>
      )}
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  row: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowId: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  unblockButton: {
    height: 44,
  },
});
