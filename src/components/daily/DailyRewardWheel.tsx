import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { WHEEL_VALUES } from '../../constants/dailyActions';
import { useTranslation } from '../../localization/useTranslation';

// A ring of fixed reward badges + a rotating pointer/arrow, NOT a pie chart
// (React Native has no conic-gradient / clip-path, so true pie wedges would
// need react-native-svg, an extra native dependency this app doesn't have).
// Visually this reads the same way a real prize-wheel spinner does: the
// pointer spins, lands on one of the six fixed values.
const WHEEL_SIZE = 220;
const RADIUS = 84;
const BADGE_SIZE = 52;
const SEGMENT_COUNT = WHEEL_VALUES.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SEGMENT_COLORS = ['#FF8FA8', '#7FB2FF', '#FFC96B', '#B08BFF', '#5FD6A0', '#FF9F6B'];

interface Props {
  // Already-known result for today (e.g. after a refresh) -- shows at rest
  // instead of re-animating a spin that already happened.
  alreadySpunReward: number | null;
  disabled: boolean;
  disabledReason?: string;
  onSpin: () => Promise<number | null>;
}

// Not gambling: no stake, no purchase, a fixed small set of pre-defined
// point values (WHEEL_VALUES), at most one spin per couple per day -- the
// "at most one" guard lives server-side (spin_daily_reward_wheel, migration
// 0019), this component just can't fire a second request while animating.
export const DailyRewardWheel = ({ alreadySpunReward, disabled, disabledReason, onSpin }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationDeg = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [landedReward, setLandedReward] = useState<number | null>(alreadySpunReward);
  const [landedIndex, setLandedIndex] = useState<number | null>(
    alreadySpunReward !== null ? WHEEL_VALUES.indexOf(alreadySpunReward as (typeof WHEEL_VALUES)[number]) : null,
  );

  const handleSpin = async () => {
    if (spinning || disabled || landedReward !== null) return;
    setSpinning(true);
    const reward = await onSpin();
    if (reward === null) {
      setSpinning(false);
      return;
    }
    const idx = Math.max(0, WHEEL_VALUES.indexOf(reward as (typeof WHEEL_VALUES)[number]));
    const target = rotationDeg.current + 5 * 360 + idx * SEGMENT_ANGLE;
    rotationDeg.current = target;

    Animated.timing(rotation, {
      toValue: target,
      duration: 2600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setLandedReward(reward);
      setLandedIndex(idx);
      setSpinning(false);
    });
  };

  const spin = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.wrap}>
      <View style={[styles.wheel, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {WHEEL_VALUES.map((value, i) => {
          const angleRad = ((i * SEGMENT_ANGLE - 90) * Math.PI) / 180;
          const x = WHEEL_SIZE / 2 + RADIUS * Math.cos(angleRad) - BADGE_SIZE / 2;
          const y = WHEEL_SIZE / 2 + RADIUS * Math.sin(angleRad) - BADGE_SIZE / 2;
          const isWinner = landedIndex === i;
          return (
            <View
              key={value}
              style={[
                styles.badge,
                {
                  left: x,
                  top: y,
                  backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  borderColor: isWinner ? colors.text : 'transparent',
                  borderWidth: isWinner ? 3 : 0,
                  transform: [{ scale: isWinner ? 1.12 : 1 }],
                },
              ]}
            >
              <Text style={styles.badgeText}>+{value}</Text>
            </View>
          );
        })}
        <View style={[styles.hub, { backgroundColor: colors.card, borderColor: colors.border }]} />
        <Animated.View style={[styles.pointerPivot, { transform: [{ rotate: spin }] }]}>
          <View style={[styles.pointer, { borderBottomColor: colors.primary }]} />
        </Animated.View>
      </View>

      {landedReward !== null ? (
        <Text style={[styles.resultText, { color: colors.success }]}>{t('dailyWheel.won', { points: landedReward })}</Text>
      ) : (
        <PrimaryButton
          label={spinning ? t('dailyWheel.spinning') : t('dailyWheel.spin')}
          onPress={handleSpin}
          disabled={disabled || spinning}
          loading={spinning}
          style={styles.spinButton}
        />
      )}
      {disabled && landedReward === null && !!disabledReason && (
        <Text style={[styles.disabledReason, { color: colors.textSecondary }]}>{disabledReason}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: '#2A2A2A',
  },
  hub: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  pointerPivot: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    position: 'absolute',
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 30,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  resultText: {
    marginTop: spacing.lg,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  spinButton: {
    marginTop: spacing.lg,
    width: 200,
  },
  disabledReason: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    textAlign: 'center',
    maxWidth: 220,
  },
});
