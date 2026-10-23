import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from '../../localization/useTranslation';
import { Language, LANGUAGES } from '../../localization';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Language'>;

const LABEL_KEY: Record<Language, 'uz' | 'ru' | 'en'> = { uz: 'uz', ru: 'ru', en: 'en' };

export const LanguageSelectScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { language, actions } = useAppStore();
  const auth = useAuth();
  const { t } = useTranslation();
  const isInitial = route.params?.mode === 'initial';

  const handleSelect = (next: Language) => {
    haptics.select();
    actions.setLanguage(next);
    if (isInitial) {
      // No profile row exists yet at this point in onboarding -- the chosen
      // language reaches Supabase later, as part of the initial createProfile
      // call (see NameScreen -> signInAnonymously).
      navigation.replace('Welcome');
    } else {
      // Revisited from Settings, after a profile already exists -- persist it
      // there too, or a reinstall/new device would silently revert to
      // whatever language the profile was originally created with.
      if (auth.session) auth.updateProfile({ language: next });
      navigation.goBack();
    }
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent style={isInitial ? styles.container : undefined}>
      {isInitial ? (
        <Text style={[styles.title, { color: colors.text }]}>{t('languageSelect.title')}</Text>
      ) : (
        <ScreenHeader title={t('languageSelect.title')} onBack={() => navigation.goBack()} />
      )}
      <View style={styles.list}>
        {LANGUAGES.map((lang) => {
          const isActive = !isInitial && lang === language;
          return (
            <Pressable
              key={lang}
              onPress={() => handleSelect(lang)}
              style={[
                styles.button,
                shadow.soft,
                {
                  backgroundColor: colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>{t(`languageSelect.${LABEL_KEY[lang]}`)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  button: {
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
