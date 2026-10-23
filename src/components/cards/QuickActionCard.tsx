import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { IconName } from '../../types';
import { IconImage } from '../common/IconImage';

interface Props {
  label: string;
  // Either a flat theme-colored glyph (the usual case) or a fixed custom
  // image (e.g. the premium roulette artwork, which must never become a
  // flat glyph) -- pass exactly one. Same card shell either way, so every
  // action card on a screen can share one component/style regardless of
  // which kind of visual it needs.
  icon?: IconName;
  imageSource?: ImageSourcePropType;
  // Overrides the icon's default role-based tint -- e.g. the partner's
  // wishlist card on Home tints its icon with the PARTNER's role color,
  // not the viewer's own.
  iconColor?: string;
  onPress: () => void;
  // Optional visual overrides, layered on top of the default theme-based
  // look -- every existing call site (AllSectionsScreen, etc.) omits these
  // and renders exactly as before. Only HomeScreen's own "Каждый день" card
  // passes these, and only for the male account's dark Home treatment.
  cardStyle?: StyleProp<ViewStyle>;
  iconWrapStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  // Small extra content pinned to the card's own top-left corner, on top of
  // its normal icon/label layout (e.g. Home's daily-quest completion count)
  // -- absolutely positioned so it never affects the card's height/size.
  topLeftContent?: React.ReactNode;
}

export const QuickActionCard = ({
  label,
  icon,
  imageSource,
  iconColor,
  onPress,
  cardStyle,
  iconWrapStyle,
  labelStyle,
  topLeftContent,
}: Props) => {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadow.soft,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        cardStyle,
      ]}
    >
      {!!topLeftContent && <View style={styles.topLeftContent}>{topLeftContent}</View>}
      <View style={[styles.iconWrap, iconWrapStyle]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.image} resizeMode="contain" />
        ) : (
          <IconImage name={icon!} size={40} color={iconColor} />
        )}
      </View>
      <Text style={[styles.label, { color: colors.text }, labelStyle]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '47%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  topLeftContent: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  image: {
    width: 40,
    height: 40,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.3,
    fontWeight: '600',
  },
});
