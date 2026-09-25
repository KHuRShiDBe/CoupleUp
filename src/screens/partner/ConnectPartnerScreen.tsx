import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { IconImage } from '../../components/common/IconImage';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectPartner'>;
type Mode = 'choose' | 'create' | 'enter';

// Real Supabase pairing: createCoupleCode()/joinCoupleByCode() call the
// create_couple/join_couple_by_code RPCs (see supabase/migrations). There is
// no local/mock pairing path here anymore -- CoupleUp's core concept needs a
// real couple, so this screen is the only way into Main.
export const ConnectPartnerScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const sync = useCoupleSync();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('choose');
  const [inputCode, setInputCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const goToMain = () => {
    haptics.confirm();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    const code = await sync.createCoupleCode();
    setCreating(false);
    if (code) {
      haptics.select();
      setCreatedCode(code);
      setMode('create');
    }
  };

  const handleJoin = async () => {
    if (joining || inputCode.trim().length < 4) return;
    setJoining(true);
    const ok = await sync.joinCoupleByCode(inputCode);
    setJoining(false);
    if (ok) goToMain();
  };

  const handleBack = () => {
    if (mode !== 'choose') {
      setMode('choose');
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('connectPartner.title')} onBack={handleBack} />
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
          <IconImage name="pair" size={48} />
        </View>
      </View>

      {sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}

      {mode === 'choose' && (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('connectPartner.chooseSubtitle')}</Text>
          <PrimaryButton
            label={t('connectPartner.createCode')}
            onPress={handleCreate}
            loading={creating}
            style={styles.actionButton}
          />
          <PrimaryButton
            label={t('connectPartner.enterCode')}
            onPress={() => setMode('enter')}
            variant="outline"
            style={styles.actionButton}
          />
        </>
      )}

      {mode === 'create' && (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('connectPartner.createSubtitle')}</Text>
          <View style={[styles.codeBox, { borderColor: colors.primary, backgroundColor: colors.card }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>{createdCode}</Text>
          </View>
          <PrimaryButton label={t('connectPartner.done')} onPress={goToMain} />
        </>
      )}

      {mode === 'enter' && (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('connectPartner.enterSubtitle')}</Text>
          <TextInput
            value={inputCode}
            onChangeText={(text) => setInputCode(text.toUpperCase())}
            placeholder={t('connectPartner.inputPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          {joining ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <PrimaryButton
              label={t('connectPartner.connect')}
              onPress={handleJoin}
              disabled={inputCode.trim().length < 4}
            />
          )}
        </>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  codeBox: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  codeText: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    letterSpacing: 4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  center: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
