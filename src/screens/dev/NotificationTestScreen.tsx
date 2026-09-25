import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { scheduleLocalTestNotification } from '../../services/notifications/pushService';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationTest'>;

// __DEV__-only screen (and __DEV__-only nav entry, see RootNavigator.tsx /
// SettingsScreen.tsx) -- never reachable in a production build. Fires real
// local notifications so the full permission -> handler -> foreground-banner
// pipeline can be exercised in Expo Go without a backend or push server.
export const NotificationTestScreen = ({ navigation }: Props) => {
  const fire = async (title: string, body: string) => {
    haptics.select();
    await scheduleLocalTestNotification(title, body);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Notification test (dev)" onBack={() => navigation.goBack()} />
      <View style={styles.list}>
        <PrimaryButton
          label="Test: action"
          onPress={() => fire('Новое доброе дело', 'Партнёр совершил доброе дело')}
          style={styles.button}
        />
        <PrimaryButton
          label="Test: reward request"
          onPress={() => fire('Новый запрос награды', 'Партнёр запросил награду')}
          style={styles.button}
        />
        <PrimaryButton
          label="Test: penalty"
          onPress={() => fire('Штраф на подтверждении', 'Партнёр создал штраф — нужно подтверждение')}
          style={styles.button}
        />
        <PrimaryButton
          label="Test: task"
          onPress={() => fire('Новое задание', 'Партнёр создал для вас задание')}
          style={styles.button}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.lg,
  },
  button: {
    marginBottom: spacing.md,
  },
});
