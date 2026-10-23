import React, { useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { ROULETTE_ITEMS, RouletteItem } from '../../constants/rouletteConfig';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleRoulette'>;

const WHEEL_SIZE = 300;
const LABEL_WIDTH = 88;
const SEGMENT_ANGLE = 360 / ROULETTE_ITEMS.length;
const SPIN_DURATION_MIN = 3500;
const SPIN_DURATION_MAX = 5000;

export const CoupleRouletteScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const spinValue = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [pendingResult, setPendingResult] = useState<RouletteItem | null>(null);
  const [resultVisible, setResultVisible] = useState(false);

  const rotateInterpolate = spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const handleSpin = () => {
    if (spinning) return;
    haptics.select();
    const idx = Math.floor(Math.random() * ROULETTE_ITEMS.length);
    const chosen = ROULETTE_ITEMS[idx];
    const fullSpins = 5 + Math.floor(Math.random() * 2);
    const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.6;
    const segmentCenter = idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const targetAngle = fullSpins * 360 + (360 - segmentCenter) + jitter;
    const duration = SPIN_DURATION_MIN + Math.random() * (SPIN_DURATION_MAX - SPIN_DURATION_MIN);

    setSpinning(true);
    setResultVisible(false);
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: targetAngle,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setPendingResult(chosen);
      setResultVisible(true);
      haptics.success();
    });
  };

  const handleAccept = () => {
    setResultVisible(false);
    haptics.confirm();
  };

  const handleSpinAgain = () => {
    setResultVisible(false);
    handleSpin();
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('roulette.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('roulette.subtitle')}</Text>

        <View style={styles.wheelArea}>
          <View style={styles.pointerWrap}>
            <View style={[styles.pointerTriangle, { borderTopColor: colors.primary }]} />
          </View>
          <View style={[styles.wheelOuter, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Animated.View style={[styles.wheelInner, { transform: [{ rotate: rotateInterpolate }] }]}>
              {ROULETTE_ITEMS.map((item, i) => {
                const angle = i * SEGMENT_ANGLE - 90;
                const rad = (angle * Math.PI) / 180;
                const r = WHEEL_SIZE / 2 - 56;
                const x = WHEEL_SIZE / 2 + r * Math.cos(rad) - LABEL_WIDTH / 2;
                const y = WHEEL_SIZE / 2 + r * Math.sin(rad) - 18;
                return (
                  <View key={item.key} style={[styles.labelWrap, { left: x, top: y }]}>
                    <View
                      style={[
                        styles.labelPill,
                        { backgroundColor: i % 2 === 0 ? colors.primary : colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        numberOfLines={2}
                        style={[styles.labelText, { color: i % 2 === 0 ? colors.textOnPrimary : colors.text }]}
                      >
                        {t(`roulette.item_${item.titleKey}` as TranslationKey)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
            <View style={[styles.wheelCenter, { backgroundColor: colors.primary }]} />
          </View>
        </View>

        <PrimaryButton
          label={spinning ? t('roulette.spinning') : t('roulette.spin')}
          onPress={handleSpin}
          disabled={spinning}
          loading={spinning}
          style={styles.spinButton}
        />
      </View>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('roulette.resultTitle')}</Text>
            <Text style={[styles.modalResult, { color: colors.primary }]}>
              {pendingResult ? t(`roulette.item_${pendingResult.titleKey}` as TranslationKey) : ''}
            </Text>
            <PrimaryButton label={t('roulette.accept')} onPress={handleAccept} style={styles.modalButton} />
            <PrimaryButton label={t('roulette.spinAgain')} onPress={handleSpinAgain} variant="outline" />
          </View>
        </View>
      </Modal>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
  wheelOuter: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wheelInner: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  labelWrap: {
    position: 'absolute',
    width: LABEL_WIDTH,
    alignItems: 'center',
  },
  labelPill: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  wheelCenter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
  },
  spinButton: {
    width: '100%',
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
