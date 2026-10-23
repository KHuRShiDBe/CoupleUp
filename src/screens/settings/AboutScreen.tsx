import React, { useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SettingsRow } from '../../components/common/SettingsRow';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useTranslation } from '../../localization/useTranslation';
import { LEGAL_URLS } from '../../constants/legal';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

// Privacy Policy / Terms / Version, compact and in one place instead of
// three big standalone cards on the main Settings screen.
export const AboutScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null);

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('settings.sectionAbout')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('settings.aboutSubtitle')}</Text>

        <SettingsRow icon="lock" label={t('settings.privacy')} onPress={() => setLegalDoc('privacy')} />
        <SettingsRow icon="lock" label={t('settings.terms')} onPress={() => setLegalDoc('terms')} />
        <SettingsRow icon="achievement" label={t('settings.version')} subtitle="1.0.0" />
        <SettingsRow
          icon="rewards"
          label={t('settings.support')}
          subtitle={t('settings.supportSubtitle')}
          onPress={() => navigation.navigate('Support')}
        />

        {/* Each only renders once a real hosted URL is filled in -- see src/constants/legal.ts */}
        {LEGAL_URLS.privacyPolicy && (
          <SettingsRow icon="lock" label={t('settings.privacyPolicyUrl')} onPress={() => Linking.openURL(LEGAL_URLS.privacyPolicy!)} />
        )}
        {LEGAL_URLS.terms && (
          <SettingsRow icon="lock" label={t('settings.termsUrl')} onPress={() => Linking.openURL(LEGAL_URLS.terms!)} />
        )}
        {LEGAL_URLS.support && (
          <SettingsRow icon="message" label={t('settings.supportUrl')} onPress={() => Linking.openURL(LEGAL_URLS.support!)} />
        )}
        {LEGAL_URLS.deleteAccount && (
          <SettingsRow icon="lock" label={t('settings.deleteAccountUrl')} onPress={() => Linking.openURL(LEGAL_URLS.deleteAccount!)} />
        )}
        <Text style={[styles.legalUrlsNote, { color: colors.textSecondary }]}>{t('settings.legalUrlsNote')}</Text>
      </ScrollView>

      <Modal visible={!!legalDoc} transparent animationType="fade" onRequestClose={() => setLegalDoc(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {legalDoc === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle')}
            </Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {legalDoc === 'privacy' ? t('legal.privacyBody') : t('legal.termsBody')}
            </Text>
            <PrimaryButton label={t('legal.close')} onPress={() => setLegalDoc(null)} />
          </View>
        </View>
      </Modal>
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
  legalUrlsNote: {
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});
