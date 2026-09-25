import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';

interface Props {
  visible: boolean;
  title: string;
  price: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Reusable mock purchase modal -- no real payment provider. Used for premium
// themes, couple decorations, and "support the developer" amounts.
export const PurchaseModal = ({ visible, title, price, description, onConfirm, onCancel }: Props) => {
  const { colors } = useTheme();
  // Guards the mock "Купить" flow against a fast double-tap firing the
  // purchase twice -- shared by Support, ThemeStore, CoupleDecorations and AppIcon.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (visible) setConfirming(false);
  }, [visible]);

  const handleConfirm = () => {
    if (confirming) return;
    setConfirming(true);
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, shadow.soft, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
          <PrimaryButton label="Купить" onPress={handleConfirm} disabled={confirming} style={styles.button} />
          <PrimaryButton label="Отмена" onPress={onCancel} variant="outline" disabled={confirming} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  price: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    marginBottom: spacing.sm,
  },
});
