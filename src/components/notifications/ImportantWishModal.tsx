import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { useAuth } from '../../store/AuthContext';
import { useWishlist } from '../../store/WishlistContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

const IMPORTANT_RED = '#E53935';

// App-wide "🚨 ВАЖНОЕ ЖЕЛАНИЕ" window (migration 0048) shown to the partner
// of a wish its author made important. Uses the existing wishlist data
// (WishlistContext, already realtime-synced), so it also appears after being
// offline. OK only marks it as read -- the wish stays in the normal list
// until it is fulfilled through the usual confirmation flow. A silent
// pulsing red frame: no sound loop, no screen lock.
export const ImportantWishModal = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const wishlist = useWishlist();
  const myId = auth.session?.user?.id ?? null;

  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const current = wishlist.items.find(
    (w) =>
      w.is_important &&
      !w.important_seen_at &&
      (w.status ?? 'active') !== 'done' &&
      !!myId &&
      w.created_by !== myId,
  );

  // Catch up when the app returns to the foreground.
  const { refresh } = wishlist;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Pulse only while the window is visible.
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    haptics.confirm();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [currentId, pulse]);

  const handleOk = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await wishlist.acknowledgeImportant(current.id);
    } finally {
      setBusy(false);
    }
  };

  const frameOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const frameScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.wrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.frame, { opacity: frameOpacity, transform: [{ scale: frameScale }] }]}
          />
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={styles.title}>{t('wishlist.importantWindowTitle')}</Text>
            {!!current && <Text style={[styles.message, { color: colors.text }]}>{current.title}</Text>}
            <PrimaryButton
              label={t('wishlist.importantOk')}
              onPress={handleOk}
              loading={busy}
              colorOverride={{ primary: IMPORTANT_RED, textOnPrimary: '#FFFFFF' }}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  wrap: {
    width: '100%',
  },
  frame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.xl + 6,
    borderWidth: 4,
    borderColor: IMPORTANT_RED,
    margin: -6,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: IMPORTANT_RED,
    fontSize: fontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    minHeight: 56,
  },
});
