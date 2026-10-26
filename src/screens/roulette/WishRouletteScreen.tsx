import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { useIntimateRoulette } from '../../store/IntimateRouletteContext';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';
import {
  WISH_ROULETTE_COOLDOWN_HOURS,
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
const LABEL_SIZE = 26;

// Fixed, non-sequential placement of sector numbers around the wheel
// (clockwise from the pointer). Number n always means prize items[n - 1]
// (same as the 📖 list); only where it sits on the wheel is shuffled. Each of
// 1..20 appears exactly once and no two neighbours (incl. 8 -> 1 wrap-around)
// are consecutive. Kept constant so the wheel looks the same every visit.
const WHEEL_ORDER = [1, 12, 5, 16, 9, 20, 3, 14, 7, 18, 11, 2, 13, 6, 17, 10, 19, 4, 15, 8];
const LABEL_RADIUS_FRACTION = 0.8;

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
  const intimate = useIntimateRoulette();

  // Locked to the signed-in user's own profile role -- never a manual choice.
  // Falls back to 'male' only in the instant before the profile row has
  // loaded; it never renders both wheels or lets the gender be picked.
  const gender: Gender = auth.profile?.role ?? 'male';

  const [spinning, setSpinning] = useState(false);
  const [resultItem, setResultItem] = useState<WishRouletteItem | null>(null);
  // 1-based sector number of the last result, as printed on the wheel.
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [prizeListVisible, setPrizeListVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [lastBalanceAfter, setLastBalanceAfter] = useState<number | null>(null);

  const spinValue = useRef(new Animated.Value(0)).current;

  const WHEEL_SIZE = Math.min(width - 64, 340);
  const R = WHEEL_SIZE / 2;

  const items = wishItemsFor(gender);
  const wheelColors = wheelColorsFor(gender);
  const theme = GENDER_THEME[gender];

  const wedges = useMemo(() => {
    return WHEEL_ORDER.map((number, i) => {
      const item = items[number - 1];
      const center = i * SEGMENT_ANGLE - 90;
      const start = center - SEGMENT_ANGLE / 2;
      const end = center + SEGMENT_ANGLE / 2;
      const pos = polar(R, R, R * LABEL_RADIUS_FRACTION, center);
      return {
        item,
        path: wedgePath(R, R, R, start, end),
        color: wheelColors[i % wheelColors.length],
        number,
        x: pos.x - LABEL_SIZE / 2,
        y: pos.y - LABEL_SIZE / 2,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, R]);

  const rotateInterpolate = spinValue.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });

  // One paid spin per WISH_ROULETTE_COOLDOWN_HOURS per user -- the server
  // enforces it (migration 0047); this only disables the button and shows
  // when the next spin is available.
  const myId = auth.session?.user?.id ?? null;
  const lastMySpin = wish.results.find((r) => r.spun_by === myId);
  const nextSpinAt = lastMySpin
    ? new Date(lastMySpin.created_at).getTime() + WISH_ROULETTE_COOLDOWN_HOURS * 3600 * 1000
    : 0;
  const cooldownMs = Math.max(0, nextSpinAt - Date.now());
  const onCooldown = cooldownMs > 0;
  const cooldownLabel = onCooldown
    ? t('wishRoulette.nextSpinIn', {
        h: Math.floor(cooldownMs / 3600000),
        m: Math.floor((cooldownMs % 3600000) / 60000),
      })
    : '';

  const costPoints = Math.round(bond.toPoints(WISH_ROULETTE_SPIN_COST_BOND));
  const canAffordNow = sync.myStats.balance >= costPoints;
  const canAffordAgain = false; // 48 h cooldown: a second spin right after a result is never allowed

  const handleSpin = async () => {
    if (spinning || !canAffordNow || onCooldown) return;
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
    // Wedge i is drawn centred on i * SEGMENT_ANGLE clockwise from the
    // pointer (see `wedges`), so that is the angle to bring under it. The old
    // extra half-sector parked the pointer on a wedge boundary, letting the
    // jitter show the neighbouring sector instead of the server's result.
    // The server's item is number safeIdx + 1; bring the wheel position that
    // shows that number (not position safeIdx) under the pointer.
    const position = WHEEL_ORDER.indexOf(safeIdx + 1);
    const segmentCenter = position * SEGMENT_ANGLE;
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
      setResultNumber(safeIdx + 1);
      setLastBalanceAfter(result.balanceAfter);
      setResultVisible(true);
      haptics.success();
      // A jackpot sector grants a coupon -- refresh so the "use coupon"
      // button below reflects it straight away.
      if (pool[safeIdx].isCoupon) intimate.refresh();
    });
  };

  // Same branching as the result card: coupon (Джекпот) -> money (other x10)
  // -> wish saved to the inventory. Shared by the result and the prize list.
  const outcomeText = (item: WishRouletteItem) =>
    item.isCoupon
      ? t('wishRoulette.wonCoupon')
      : item.rarity === 'x10'
        ? t('wishRoulette.valueLabel', { bond: item.valueBond })
        : t('wishRoulette.savedToInventory');

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
            <Pressable
              onPress={() => setPrizeListVisible(true)}
              disabled={spinning}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('wishRoulette.prizeListButton')}
              style={({ pressed }) => [
                styles.bookButton,
                shadow.soft,
                { backgroundColor: colors.card, borderColor: theme.primary, opacity: pressed || spinning ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.bookIcon}>📖</Text>
            </Pressable>
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
                <View key={w.item.key} style={[styles.labelWrap, { left: w.x, top: w.y }]}>
                  <Text style={styles.labelNumber}>{w.number}</Text>
                </View>
              ))}
              <View style={[styles.centerHeart, { left: R - 14, top: R - 14 }]}>
                <Text style={styles.centerHeartText}>❤️</Text>
              </View>
            </Animated.View>
          </View>

          {!canAffordNow && <Text style={styles.warnText}>{t('wishRoulette.balanceLabel', { bond: formatBond(bond.toBond(sync.myStats.balance)) })}</Text>}

          <PrimaryButton
            label={spinning ? t('wishRoulette.spinning') : onCooldown ? cooldownLabel : t('wishRoulette.spin')}
            onPress={handleSpin}
            disabled={spinning || !canAffordNow || onCooldown}
            loading={spinning}
            colorOverride={{ primary: theme.primary, textOnPrimary: theme.textOnPrimary }}
            style={styles.spinButton}
          />

          {/* Jackpot coupons are still spent in the intimate roulette (server
              RPC spin_intimate_roulette, mutual consent) -- shown only when
              the couple actually holds coupons, so none are lost. */}
          {intimate.couponCount > 0 && (
            <PrimaryButton
              label={t('wishRoulette.useCoupon', { count: intimate.couponCount })}
              onPress={() => navigation.navigate('IntimateRoulette')}
              disabled={spinning}
              variant="outline"
              colorOverride={{ primary: theme.primary, textOnPrimary: theme.textOnPrimary }}
              style={styles.couponButton}
            />
          )}
        </ScrollView>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: colors.textSecondary }]}>{t('wishRoulette.resultTitle')}</Text>
            {!!resultItem && (
              <>
                {resultNumber !== null && (
                  <View style={[styles.resultNumberBadge, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.resultNumberText, { color: theme.textOnPrimary }]}>
                      {t('wishRoulette.sectorNumber', { n: resultNumber })}
                    </Text>
                  </View>
                )}
                <Text style={styles.modalEmoji}>{resultItem.emoji}</Text>
                <Text style={[styles.modalItemTitle, { color: colors.text }]}>
                  {t(`wishRoulette.item_${resultItem.titleKey}` as TranslationKey)}
                </Text>
              </>
            )}
            <PrimaryButton label={t('wishRoulette.accept')} onPress={handleAccept} style={styles.modalButton} />
            {canAffordAgain && (
              <PrimaryButton label={t('wishRoulette.spinAgain')} onPress={handleSpinAgain} variant="outline" />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={prizeListVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrizeListVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPrizeListVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>📖 {t('wishRoulette.prizeListTitle')}</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>{t('wishRoulette.prizeListSubtitle')}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {items.map((item, i) => (
                <View
                  key={item.key}
                  style={[
                    styles.prizeRow,
                    { borderColor: colors.border },
                    resultNumber === i + 1 && { backgroundColor: theme.soft, borderColor: theme.primary },
                  ]}
                >
                  <View style={[styles.prizeNumber, { backgroundColor: wheelColors[WHEEL_ORDER.indexOf(i + 1) % wheelColors.length] }]}>
                    <Text style={styles.prizeNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.prizeEmoji}>{item.emoji}</Text>
                  <View style={styles.prizeInfo}>
                    <Text style={[styles.prizeTitle, { color: colors.text }]} numberOfLines={2}>
                      {t(`wishRoulette.item_${item.titleKey}` as TranslationKey)}
                    </Text>
                    <Text style={[styles.prizeOutcome, { color: colors.textSecondary }]}>
                      {outcomeText(item)}
                    </Text>
                  </View>
                  <View style={[styles.prizeRarity, { backgroundColor: RARITY_BADGE_COLOR[item.rarity] }]}>
                    <Text style={styles.rarityBadgeText}>{t(RARITY_LABEL_KEY[item.rarity])}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <PrimaryButton
              label={t('wishRoulette.prizeListClose')}
              onPress={() => setPrizeListVisible(false)}
              colorOverride={{ primary: theme.primary, textOnPrimary: theme.textOnPrimary }}
              style={styles.sheetClose}
            />
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
    alignSelf: 'stretch',
  },
  bookButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIcon: {
    fontSize: 22,
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
    width: LABEL_SIZE,
    height: LABEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelNumber: {
    fontSize: 14,
    fontWeight: '800',
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
  couponButton: {
    width: '100%',
    marginTop: spacing.sm,
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
  resultNumberBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  resultNumberText: {
    fontSize: fontSize.md,
    fontWeight: '800',
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  sheetList: {
    flexGrow: 0,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  prizeNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeNumberText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  prizeEmoji: {
    fontSize: 22,
    marginHorizontal: spacing.sm,
  },
  prizeInfo: {
    flex: 1,
  },
  prizeTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  prizeOutcome: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  prizeRarity: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  sheetClose: {
    marginTop: spacing.sm,
    width: '100%',
  },
});
