import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { PurchaseModal } from '../../components/common/PurchaseModal';
import { useAppStore } from '../../store/AppContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;

const AMOUNTS = ['$1', '$3', '$5', '$10', '$25'];

export const SupportCoupleUpScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { actions } = useAppStore();
  const { t } = useTranslation();
  const [selectedAmount, setSelectedAmount] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [thanked, setThanked] = useState(false);

  const openConfirm = (amount: string) => setSelectedAmount(amount);

  const handleCustomContinue = () => {
    const value = customAmount.replace(/[^0-9]/g, '');
    if (!value) return;
    openConfirm(`$${value}`);
  };

  const handleConfirm = () => {
    if (!selectedAmount) return;
    haptics.success();
    actions.recordSupport(selectedAmount);
    setSelectedAmount(null);
    setThanked(true);
  };

  if (thanked) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('support.title')} onBack={() => navigation.goBack()} />
        <View style={styles.thanksWrap}>
          <View style={styles.iconWrap}>
            <IconImage name="pair" size={56} />
          </View>
          <Text style={[styles.thanksTitle, { color: colors.text }]}>{t('support.thanksTitle')}</Text>
          <Text style={[styles.thanksText, { color: colors.textSecondary }]}>{t('support.thanksText')}</Text>
          <PrimaryButton label={t('support.done')} onPress={() => navigation.goBack()} style={styles.doneButton} />
        </View>
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('support.title')} onBack={() => navigation.goBack()} />
      <Text style={[styles.title, { color: colors.text }]}>{t('support.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('support.subtitle')}</Text>

      <View style={styles.grid}>
        {AMOUNTS.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => openConfirm(amount)}
            style={[styles.amountCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.amountText, { color: colors.primary }]}>{amount}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowCustom((v) => !v)}
          style={[
            styles.amountCard,
            shadow.soft,
            { backgroundColor: showCustom ? colors.background : colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.amountText, { color: colors.text, fontSize: fontSize.sm }]}>{t('support.otherAmount')}</Text>
        </Pressable>
      </View>

      {showCustom && (
        <View style={styles.customBox}>
          <TextInput
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder={t('support.amountPlaceholder')}
            keyboardType="number-pad"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          <PrimaryButton label={t('support.continueButton')} onPress={handleCustomContinue} disabled={!customAmount.trim()} />
        </View>
      )}

      <PurchaseModal
        visible={!!selectedAmount}
        title={t('support.title')}
        price={selectedAmount ?? ''}
        description={t('support.purchaseDescription')}
        onConfirm={handleConfirm}
        onCancel={() => setSelectedAmount(null)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  amountCard: {
    width: '31%',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  amountText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  customBox: {
    marginTop: spacing.sm,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  thanksWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: spacing.lg,
  },
  thanksTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  thanksText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  doneButton: {
    width: '100%',
  },
});
