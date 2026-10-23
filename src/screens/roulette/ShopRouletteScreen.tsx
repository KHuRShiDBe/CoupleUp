import React, { useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useShopRoulette } from '../../store/ShopRouletteContext';
import { SHOP_ROULETTE_ITEMS, SHOP_ROULETTE_SPIN_COST_BOND } from '../../constants/shopRoulette';
import { formatRelativeTime } from '../../utils/date';
import { formatBond } from '../../utils/bond';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopRoulette'>;

const WHEEL_IMAGE = require('../../../assets/roulette/shop-roulette.png');
const WHEEL_SIZE = 300;
const SPIN_DURATION_MIN = 3500;
const SPIN_DURATION_MAX = 5000;
const SEGMENT_ANGLE = 360 / SHOP_ROULETTE_ITEMS.length;

export const ShopRouletteScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const bond = useBond();
  const roulette = useShopRoulette();

  const spinValue = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [lastBalanceAfter, setLastBalanceAfter] = useState<number | null>(null);

  const rotateInterpolate = spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const costPoints = Math.round(bond.toPoints(SHOP_ROULETTE_SPIN_COST_BOND));
  const canAffordBond = sync.myStats.balance >= costPoints;
  const canAffordAgainBond = lastBalanceAfter !== null && lastBalanceAfter >= costPoints;
  const hasCoupon = roulette.couponCount > 0;

  // The server (spin_shop_roulette, migration 0032) picks the winning sector
  // -- this only animates the wheel to whatever index that item_key maps to,
  // it never rolls its own result. Payment happens on every spin, including
  // a re-spin from the result modal -- not on dismissing the modal.
  const handleSpin = async (useCoupon: boolean) => {
    if (spinning) return;
    if (useCoupon ? !hasCoupon : !canAffordBond) return;
    haptics.select();
    setSpinning(true);
    setResultVisible(false);

    const spinResult = await roulette.spin(useCoupon);
    if (!spinResult) {
      setSpinning(false);
      return;
    }

    const idx = SHOP_ROULETTE_ITEMS.findIndex((item) => item.key === spinResult.itemKey);
    const safeIdx = idx >= 0 ? idx : 0;
    const fullSpins = 5 + Math.floor(Math.random() * 2);
    const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.6;
    const segmentCenter = safeIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
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
      setPendingItemKey(spinResult.itemKey);
      setLastBalanceAfter(spinResult.balanceAfter);
      setResultVisible(true);
      haptics.success();
    });
  };

  const handleAccept = () => {
    haptics.confirm();
    setResultVisible(false);
  };

  const handleSpinAgain = () => {
    setResultVisible(false);
    handleSpin(false);
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('shopRoulette.title')} onBack={() => navigation.goBack()} />
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!roulette.error && <BackendStatusBanner message={roulette.error} onRetry={roulette.clearError} />}

        <View style={[styles.infoCard, shadow.soft, { backgroundColor: colors.primary }]}>
          <Text style={[styles.infoLine, { color: '#FFFFFF' }]}>
            {t('shopRoulette.spinCostLabel', { bond: SHOP_ROULETTE_SPIN_COST_BOND })}
          </Text>
          <Text style={[styles.infoLine, { color: '#FFFFFF', opacity: 0.9 }]}>
            {t('shopRoulette.couponsLabel', { count: roulette.couponCount })}
          </Text>
        </View>

        <View style={styles.wheelArea}>
          <View style={styles.pointerWrap}>
            <View style={[styles.pointerTriangle, { borderTopColor: colors.primary }]} />
          </View>
          <Animated.View style={[styles.wheelWrap, shadow.soft, { transform: [{ rotate: rotateInterpolate }] }]}>
            <Image source={WHEEL_IMAGE} style={styles.wheelImage} resizeMode="contain" />
          </Animated.View>
        </View>

        <PrimaryButton
          label={spinning ? t('shopRoulette.spinning') : t('shopRoulette.spin', { bond: SHOP_ROULETTE_SPIN_COST_BOND })}
          onPress={() => handleSpin(false)}
          disabled={spinning || !canAffordBond}
          loading={spinning}
          style={styles.spinButton}
        />
        {hasCoupon && (
          <PrimaryButton
            label={spinning ? t('shopRoulette.spinning') : t('shopRoulette.spinForCoupon')}
            onPress={() => handleSpin(true)}
            disabled={spinning}
            loading={spinning}
            variant="outline"
            style={styles.spinButton}
          />
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('shopRoulette.recentResults')}</Text>
        {roulette.results.length === 0 ? (
          <Text style={[styles.noResults, { color: colors.textSecondary }]}>{t('shopRoulette.noResults')}</Text>
        ) : (
          roulette.results.map((r) => (
            <View key={r.id} style={[styles.resultRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.resultRowLabel, { color: colors.text }]}>
                {t(`shopRoulette.item_${r.item_key}` as TranslationKey)}
              </Text>
              <Text style={[styles.resultRowTime, { color: colors.textSecondary }]}>{formatRelativeTime(r.created_at)}</Text>
            </View>
          ))
        )}
      </Animated.ScrollView>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('shopRoulette.resultTitle')}</Text>
            <Text style={[styles.modalResult, { color: colors.primary }]}>
              {pendingItemKey ? t(`shopRoulette.item_${pendingItemKey}` as TranslationKey) : ''}
            </Text>
            <Text style={[styles.modalValue, { color: colors.textSecondary }]}>{t('shopRoulette.savedToInventory')}</Text>
            <PrimaryButton label={t('shopRoulette.accept')} onPress={handleAccept} style={styles.modalButton} />
            {canAffordAgainBond && (
              <PrimaryButton label={t('shopRoulette.spinAgain')} onPress={handleSpinAgain} variant="outline" />
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  infoCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoLine: {
    fontSize: fontSize.sm,
    fontWeight: '700',
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
    width: '100%',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noResults: {
    fontSize: fontSize.sm,
    alignSelf: 'flex-start',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
    marginBottom: spacing.sm,
  },
  modalValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalButton: {
    marginBottom: spacing.sm,
    width: '100%',
  },
});
