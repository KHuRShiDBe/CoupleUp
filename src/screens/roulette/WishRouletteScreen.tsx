import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { femaleTheme } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useTranslation, TranslationKey } from '../../localization/useTranslation';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useWishRoulette } from '../../store/WishRouletteContext';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';
import {
  WISH_ROULETTE_SPIN_COST_BOND,
  WishRarity,
  WishRouletteItem,
  wheelColorsFor,
  wishItemsFor,
} from '../../constants/wishRouletteConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'WishRoulette'>;
type Gender = 'male' | 'female';

const SEGMENT_COUNT = 20;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MIN = 3500;
const SPIN_DURATION_MAX = 5000;
const LABEL_WIDTH = 34;
const LABEL_RADIUS_FRACTION = 0.74;

// Male kept exactly as before (not touched). Female used to hardcode its own
// hot-pink '#E91E8C'/'#FFEAF4' here, duplicating (and drifting from) the app
// theme -- now reads straight from theme/colors.ts's femaleTheme instead, so
// the balance/BOND card above the wheel matches the rest of the app.
const GENDER_THEME: Record<Gender, { primary: string; textOnPrimary: string; soft: string }> = {
  male: { primary: '#1565C0', textOnPrimary: '#FFFFFF', soft: '#EAF3FF' },
  female: { primary: femaleTheme.primary, textOnPrimary: femaleTheme.textOnPrimary, soft: femaleTheme.card },
};

const RARITY_LABEL_KEY: Record<WishRarity, TranslationKey> = {
  cheap: 'wishRoulette.rarity_cheap',
  almostBreakeven: 'wishRoulette.rarity_almostBreakeven',
  x1: 'wishRoulette.rarity_x1',
  x3: 'wishRoulette.rarity_x3',
  x10: 'wishRoulette.rarity_x10',
};

const RARITY_BADGE_COLOR: Record<WishRarity, string> = {
  cheap: '#9AA1B1',
  almostBreakeven: '#4FA3E3',
  x1: '#2F80ED',
  x3: '#9C4DCC',
  x10: '#F2A93B',
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const wedgePath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const p0 = polar(cx, cy, r, startDeg);
  const p1 = polar(cx, cy, r, endDeg);
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
};

export const WishRouletteScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const sync = useCoupleSync();
  const bond = useBond();
  const wish = useWishRoulette();

  // Locked to the signed-in user's own profile role -- never a manual choice.
  // Falls back to 'male' only in the instant before the profile row has
  // loaded; it never renders both wheels or lets the gender be picked.
  const gender: Gender = auth.profile?.role ?? 'male';

  const [spinning, setSpinning] = useState(false);
  const [resultItem, setResultItem] = useState<WishRouletteItem | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [lastBalanceAfter, setLastBalanceAfter] = useState<number | null>(null);

  const spinValue = useRef(new Animated.Value(0)).current;

  const WHEEL_SIZE = Math.min(width - 64, 340);
  const R = WHEEL_SIZE / 2;

  const items = wishItemsFor(gender);
  const wheelColors = wheelColorsFor(gender);
  const theme = GENDER_THEME[gender];

  const wedges = useMemo(() => {
    return items.map((item, i) => {
      const center = i * SEGMENT_ANGLE - 90;
      const start = center - SEGMENT_ANGLE / 2;
      const end = center + SEGMENT_ANGLE / 2;
      const pos = polar(R, R, R * LABEL_RADIUS_FRACTION, center);
      return {
        item,
        path: wedgePath(R, R, R, start, end),
        color: wheelColors[i % wheelColors.length],
        x: pos.x - LABEL_WIDTH / 2,
        y: pos.y - 16,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, R]);

  const rotateInterpolate = spinValue.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });

  const costPoints = Math.round(bond.toPoints(WISH_ROULETTE_SPIN_COST_BOND));
  const canAffordNow = sync.myStats.balance >= costPoints;
  const canAffordAgain = lastBalanceAfter !== null && lastBalanceAfter >= costPoints;

  const handleSpin = async () => {
    if (spinning || !canAffordNow) return;
    haptics.select();
    setSpinning(true);
    const result = await wish.spin(gender);
    if (!result) {
      setSpinning(false);
      return;
    }
    const pool = wishItemsFor(gender);
    const idx = pool.findIndex((p) => p.key === result.itemKey);
    const safeIdx = idx >= 0 ? idx : 0;
    const segmentCenter = safeIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const fullSpins = 5 + Math.floor(Math.random() * 2);
    const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.6;
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
      setResultItem(pool[safeIdx]);
      setLastBalanceAfter(result.balanceAfter);
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
    handleSpin();
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('wishRoulette.title')} onBack={() => navigation.goBack()} />

      {!!wish.error && <BackendStatusBanner message={wish.error} onRetry={wish.clearError} />}

      {/* key={gender} guards against any leftover state/animation if the
          profile's role ever changes while this screen is mounted -- but
          gender is never a manual choice, so exactly one wheel (this one,
          picked by the signed-in user's own profile.role) is ever rendered. */}
      <ScrollView key={gender} showsVerticalScrollIndicator={false} contentContainerStyle={styles.wheelScroll}>
          <View style={[styles.infoCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLine, { color: colors.text }]}>
              {t('wishRoulette.spinCostLabel', { bond: WISH_ROULETTE_SPIN_COST_BOND })}
            </Text>
            <Text style={[styles.infoLine, { color: colors.textSecondary }]}>
              {t('wishRoulette.balanceLabel', { bond: formatBond(bond.toBond(sync.myStats.balance)) })}
            </Text>
          </View>

          <View style={styles.wheelArea}>
            <View style={styles.pointerWrap}>
              <View style={[styles.pointerTriangle, { borderTopColor: theme.primary }]} />
            </View>
            <Animated.View style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, transform: [{ rotate: rotateInterpolate }] }}>
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                {wedges.map((w) => (
                  <Path key={w.item.key} d={w.path} fill={w.color} stroke="#FFFFFF" strokeWidth={1.5} />
                ))}
                <Circle cx={R} cy={R} r={R - 2} stroke="#FFFFFF" strokeWidth={4} fill="none" />
                <Circle cx={R} cy={R} r={R * 0.16} fill="#FFFFFF" stroke={theme.primary} strokeWidth={3} />
              </Svg>
              {wedges.map((w) => (
                <View key={w.item.key} style={[styles.labelWrap, { left: w.x, top: w.y, width: LABEL_WIDTH }]}>
                  <Text style={styles.labelEmoji}>{w.item.emoji}</Text>
                  <Text numberOfLines={3} style={styles.labelText}>
                    {t(`wishRoulette.item_${w.item.titleKey}` as TranslationKey)}
                  </Text>
                </View>
              ))}
              <View style={[styles.centerHeart, { left: R - 14, top: R - 14 }]}>
                <Text style={styles.centerHeartText}>❤️</Text>
              </View>
            </Animated.View>
          </View>

          {!canAffordNow && <Text style={styles.warnText}>{t('wishRoulette.balanceLabel', { bond: formatBond(bond.toBond(sync.myStats.balance)) })}</Text>}

          <PrimaryButton
            label={spinning ? t('wishRoulette.spinning') : t('wishRoulette.spin')}
            onPress={handleSpin}
            disabled={spinning || !canAffordNow}
            loading={spinning}
            colorOverride={{ primary: theme.primary, textOnPrimary: theme.textOnPrimary }}
            style={styles.spinButton}
          />
        </ScrollView>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: colors.textSecondary }]}>{t('wishRoulette.resultTitle')}</Text>
            {!!resultItem && (
              <>
                <Text style={styles.modalEmoji}>{resultItem.emoji}</Text>
                <Text style={[styles.modalItemTitle, { color: colors.text }]}>
                  {t(`wishRoulette.item_${resultItem.titleKey}` as TranslationKey)}
                </Text>
                <View style={[styles.rarityBadge, { backgroundColor: RARITY_BADGE_COLOR[resultItem.rarity] }]}>
                  <Text style={styles.rarityBadgeText}>{t(RARITY_LABEL_KEY[resultItem.rarity])}</Text>
                </View>
                {/* isCoupon (the "Джекпот" sector, migration 0031) grants a
                    free intimate-roulette spin, not BOND -- checked before
                    the 'x10' money-prize case. Every other 'x10' item is
                    still real money (matches prize_kind='money' in
                    spin_wish_roulette); every non-x10 item is a wish, saved
                    to the inventory, never credited as BOND. */}
                {resultItem.isCoupon ? (
                  <Text style={[styles.modalValue, { color: colors.text }]}>{t('wishRoulette.wonCoupon')}</Text>
                ) : resultItem.rarity === 'x10' ? (
                  <Text style={[styles.modalValue, { color: colors.text }]}>
                    {t('wishRoulette.valueLabel', { bond: resultItem.valueBond })}
                  </Text>
                ) : (
                  <Text style={[styles.modalValue, { color: colors.text }]}>{t('wishRoulette.savedToInventory')}</Text>
                )}
              </>
            )}
            <PrimaryButton label={t('wishRoulette.accept')} onPress={handleAccept} style={styles.modalButton} />
            {canAffordAgain && (
              <PrimaryButton label={t('wishRoulette.spinAgain')} onPress={handleSpinAgain} variant="outline" />
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  wheelScroll: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  infoCard: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
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
  labelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  labelEmoji: {
    fontSize: 12,
    lineHeight: 13,
  },
  labelText: {
    fontSize: 6.5,
    lineHeight: 7.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  centerHeart: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHeartText: {
    fontSize: 16,
  },
  warnText: {
    color: '#E53935',
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
  modalTitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  modalItemTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  rarityBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  rarityBadgeText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  modalValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  modalButton: {
    marginBottom: spacing.sm,
    width: '100%',
  },
});
