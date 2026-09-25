import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { IconImage } from '../common/IconImage';
import { useNotifications } from '../../store/NotificationsContext';
import { navigateFromNotification } from '../../navigation/navigationRef';

// A quiet in-app banner for foreground notifications, replacing the OS popup
// (the notification handler in pushService.ts suppresses that). Auto-dismisses
// after a few seconds; tapping it navigates like a real push tap would.
export const InAppNotificationBanner = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { banner, dismissBanner } = useNotifications();
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!banner) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
    const timer = setTimeout(() => {
      Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => dismissBanner());
    }, 4000);
    return () => clearTimeout(timer);
  }, [banner, translateY, dismissBanner]);

  if (!banner) return null;

  const handlePress = () => {
    navigateFromNotification(banner.type);
    dismissBanner();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing.sm, transform: [{ translateY }] }]}
    >
      <Pressable
        onPress={handlePress}
        style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <IconImage name="notification" size={22} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  body: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  text: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
