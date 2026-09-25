import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { useTranslation } from '../../localization/useTranslation';

interface Props {
  text: string;
}

// Collapsed by default so it never adds visual weight to a screen that
// doesn't need it -- tap to expand a short plain-language explainer for a
// section that isn't self-evident from its UI alone (BOND rate, Daily
// Actions/Bonus/Wheel, purchase negotiation, etc).
export const HowItWorksNote = ({ text }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.toggle} hitSlop={6}>
        <Text style={[styles.toggleText, { color: colors.primary }]}>
          {open ? '▾ ' : '▸ '}
          {t('common.howItWorks')}
        </Text>
      </Pressable>
      {open && (
        <View style={[styles.body, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{text}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  toggle: {
    alignSelf: 'flex-start',
  },
  toggleText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  body: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  bodyText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});
