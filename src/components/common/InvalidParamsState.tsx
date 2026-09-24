import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenContainer } from './ScreenContainer';
import { ScreenHeader } from './ScreenHeader';
import { ErrorState } from './ErrorState';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { useTranslation } from '../../localization/useTranslation';

interface Props {
  message: string;
}

// Shown instead of a screen whose required route params are missing or
// unknown (e.g. a stale deep link). Never substitutes a default -- it only
// explains and offers a way out: back if there is history, otherwise Splash,
// which re-derives the right destination from onboarding/auth state.
export const InvalidParamsState = ({ message }: Props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('recovery.invalidParamsTitle')} onBack={leave} />
      <ErrorState title={t('recovery.invalidParamsTitle')} message={message} />
      <PrimaryButton label={t('recovery.goBack')} onPress={leave} />
    </ScreenContainer>
  );
};
