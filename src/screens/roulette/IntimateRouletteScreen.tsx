import React, { useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useIntimateRoulette } from '../../store/IntimateRouletteContext';
import {
  INTIMATE_CATEGORIES,
  INTIMATE_OPTIONS,
  INTIMATE_ROULETTE_SPIN_COST_BOND,
  IntimateCategory,
  IntimateOption,
  pickRandomOption,
} from '../../constants/intimateRoulette';
import { formatRelativeTime } from '../../utils/date';
import { formatBond } from '../../utils/bond';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'IntimateRoulette'>;

const WHEEL_IMAGE = require('../../../assets/roulette/intimate-roulette.png');
const SPIN_DURATION_MIN = 3500;
const SPIN_DURATION_MAX = 5000;
const SEGMENT_ANGLE = 360 / INTIMATE_OPTIONS.length;

export const IntimateRouletteScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const bond = useBond();
  const roulette = useIntimateRoulette();

  const spinValue = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [pendingResult, setPendingResult] = useState<IntimateOption | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [lastBalanceAfter, setLastBalanceAfter] = useState<number | null>(null);

  const rotateInterpolate = spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const costPoints = Math.round(bond.toPoints(INTIMATE_ROULETTE_SPIN_COST_BOND));
  const canAffordBond = sync.myStats.balance >= costPoints;
  const canAffordAgainBond = lastBalanceAfter !== null && lastBalanceAfter >= costPoints;
  const hasCoupon = roulette.couponCount > 0;

  // Payment (BOND or a coupon) happens on every spin, including a re-spin
  // from the result modal -- not on "Принять" -- otherwise re-rolling for a
  // better outcome would be free and the price would mean nothing. The
  // server (spin_intimate_roulette, migration 0031) is the sole authority on
  // whether this spin is actually paid for; if it says no, nothing animates.
  const handleSpin = async (useCoupon: boolean) => {
    if (spinning || !roulette.bothConsented) return;
    if (useCoupon ? !hasCoupon : !canAffordBond) return;
    haptics.select();
    setSpinning(true);
    setResultVisible(false);

    const chosen = pickRandomOption(roulette.allowed);
    const spinResult = await roulette.spin(chosen.key, useCoupon);
    if (!spinResult) {
      setSpinning(false);
      return;
    }

    const idx = INTIMATE_OPTIONS.findIndex((o) => o.key === chosen.key);
    const fullSpins = 5 + Math.floor(Math.random() * 2); // 5-6 full turns for a convincing spin
    // The wheel image's segments run clockwise from the top (index 0 =
    // "Миссионерская" at 12 o'clock). To bring segment `idx`'s center under
    // the fixed top pointer, the wheel must rotate clockwise by
    // (360 - that segment's clockwise offset from the top), plus full spins
    // for visual effect. A small random jitter keeps it off dead-center.
    const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.6;
    const segmentCenter = idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetAngle = fullSpins * 360 + (360 - segmentCenter) + jitter;
    const duration = SPIN_DURATION_MIN + Math.random() * (SPIN_DURATION_MAX - SPIN_DURATION_MIN);

    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: targetAngle,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setPendingResult(chosen);
      setLastBalanceAfter(spinResult.balanceAfter);
      setResultVisible(true);
      haptics.success();
    });
  };

  // The result was already paid for and recorded server-side the moment the
  // spin happened -- "Принять" is just closing the modal, not another
  // network call.
  const handleAccept = () => {
    haptics.confirm();
    setResultVisible(false);
  };

  const handleSpinAgain = () => {
    setResultVisible(false);
    handleSpin(false);
  };

  const toggleCategory = (category: IntimateCategory, value: boolean) => {
    haptics.select();
    roulette.updateAllowed({ ...roulette.allowed, [category]: value });
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('intimateRoulette.title')} onBack={() => navigation.goBack()} />
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!roulette.error && <BackendStatusBanner message={roulette.error} onRetry={roulette.clearError} />}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('intimateRoulette.subtitle')}</Text>

        <View style={[styles.infoCard, shadow.soft, { backgroundColor: colors.primary }]}>
          <Text style={[styles.infoLine, { color: '#FFFFFF' }]}>
            {t('intimateRoulette.spinCostLabel', { bond: INTIMATE_ROULETTE_SPIN_COST_BOND })}
          </Text>
          <Text style={[styles.infoLine, { color: '#FFFFFF', opacity: 0.9 }]}>
            {t('intimateRoulette.couponsLabel', { count: roulette.couponCount })}
          </Text>
        </View>

        {!roulette.bothConsented ? (
          <View style={[styles.consentCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.consentRequired, { color: colors.text }]}>{t('intimateRoulette.consentRequired')}</Text>
            <Text style={[styles.consentExplain, { color: colors.textSecondary }]}>{t('intimateRoulette.consentExplain')}</Text>
            <View style={styles.consentRow}>
              <Text style={[styles.consentLabel, { color: colors.text }]}>{t('intimateRoulette.myConsentToggle')}</Text>
              <Switch
                value={roulette.myConsent}
                onValueChange={(v) => roulette.setMyConsent(v)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            <Text style={[styles.partnerStatus, { color: roulette.partnerConsent ? colors.success : colors.textSecondary }]}>
              {roulette.partnerConsent ? t('intimateRoulette.partnerConsentYes') : t('intimateRoulette.partnerConsentNo')}
            </Text>
          </View>
        ) : (
          <View style={styles.consentOkRow}>
            <Text style={[styles.consentLabel, { color: colors.text }]}>{t('intimateRoulette.myConsentToggle')}</Text>
            <Switch
              value={roulette.myConsent}
              onValueChange={(v) => roulette.setMyConsent(v)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        )}

        <View style={styles.wheelArea}>
          <View style={styles.pointerWrap}>
            <View style={[styles.pointerTriangle, { borderTopColor: colors.primary }]} />
          </View>
          <Animated.View style={[styles.wheelWrap, shadow.soft, { transform: [{ rotate: rotateInterpolate }] }]}>
            <Image source={WHEEL_IMAGE} style={styles.wheelImage} resizeMode="contain" />
          </Animated.View>
        </View>

        <PrimaryButton
          label={spinning ? t('intimateRoulette.spinning') : t('intimateRoulette.spin', { bond: INTIMATE_ROULETTE_SPIN_COST_BOND })}
          onPress={() => handleSpin(false)}
          disabled={spinning || !roulette.bothConsented || !canAffordBond}
          loading={spinning}
          style={styles.spinButton}
        />
        {hasCoupon && (
          <PrimaryButton
            label={spinning ? t('intimateRoulette.spinning') : t('intimateRoulette.spinForCoupon')}
            onPress={() => handleSpin(true)}
            disabled={spinning || !roulette.bothConsented}
            loading={spinning}
            variant="outline"
            style={styles.spinButton}
          />
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('intimateRoulette.allowedToday')}</Text>
        <View style={[styles.allowedCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {INTIMATE_CATEGORIES.map((category) => (
            <View key={category} style={styles.allowedRow}>
              <Text style={[styles.allowedLabel, { color: colors.text }]}>
                {t(`intimateRoulette.category_${category}` as TranslationKey)}
              </Text>
              <Switch
                value={roulette.allowed[category]}
                onValueChange={(v) => toggleCategory(category, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('intimateRoulette.recentResults')}</Text>
        {roulette.results.length === 0 ? (
          <Text style={[styles.noResults, { color: colors.textSecondary }]}>{t('intimateRoulette.noResults')}</Text>
        ) : (
          roulette.results.map((r) => (
            <View key={r.id} style={[styles.resultRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.resultRowLabel, { color: colors.text }]}>
                {t(`intimateRoulette.option_${r.result_key}` as TranslationKey)}
              </Text>
              <Text style={[styles.resultRowTime, { color: colors.textSecondary }]}>{formatRelativeTime(r.created_at)}</Text>
            </View>
          ))
        )}
      </Animated.ScrollView>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('intimateRoulette.resultTitle')}</Text>
            <Text style={[styles.modalResult, { color: colors.primary }]}>
              {pendingResult ? t(`intimateRoulette.option_${pendingResult.key}` as TranslationKey) : ''}
            </Text>
            <PrimaryButton label={t('intimateRoulette.accept')} onPress={handleAccept} style={styles.modalButton} />
            {canAffordAgainBond && (
              <PrimaryButton label={t('intimateRoulette.spinAgain')} onPress={handleSpinAgain} variant="outline" />
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const WHEEL_SIZE = 300;

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  infoCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoLine: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  consentCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  consentRequired: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  consentExplain: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  consentOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  consentLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  partnerStatus: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  wheelArea: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pointerWrap: {
    zIndex: 2,
    marginBottom: -6,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 22,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  wheelWrap: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
  },
  wheelImage: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  spinButton: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  allowedCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  allowedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  allowedLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  noResults: {
    fontSize: fontSize.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultRowLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  resultRowTime: {
    fontSize: fontSize.xs,
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
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  modalResult: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalButton: {
    marginBottom: spacing.sm,
    width: '100%',
  },
});
