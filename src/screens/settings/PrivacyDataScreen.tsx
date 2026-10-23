import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SettingsRow } from '../../components/common/SettingsRow';
import { useTranslation } from '../../localization/useTranslation';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyData'>;

// One hub for everything privacy/data related, instead of 4-5 separate rows
// on the main Settings screen -- each destination screen is unchanged.
export const PrivacyDataScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('settings.privacyDataHub')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SettingsRow icon="lock" label={t('settings.privacyScreen')} onPress={() => navigation.navigate('Privacy')} />
        <SettingsRow
          icon="notification"
          label={t('settings.dataPermissions')}
          onPress={() => navigation.navigate('DataPermissions')}
        />
        <SettingsRow
          icon="lock"
          label={t('settings.privacyCenter')}
          subtitle={t('settings.privacyCenterSubtitle')}
          onPress={() => navigation.navigate('PrivacyCenter')}
        />
        <SettingsRow
          icon="lock"
          label={t('settings.blockedUsers')}
          subtitle={t('settings.blockedUsersSubtitle')}
          onPress={() => navigation.navigate('BlockedUsers')}
        />
      </ScrollView>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
});
