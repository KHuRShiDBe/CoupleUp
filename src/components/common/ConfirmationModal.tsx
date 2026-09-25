import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { PrimaryButton } from '../buttons/PrimaryButton';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Single reusable yes/no modal for: accepting a penalty/reward request,
// declining a task request, leaving a couple, resetting local data.
export const ConfirmationModal = ({
  visible,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: Props) => {
  const { colors } = useTheme();
  // A fast double-tap on "confirm" must only ever fire the action once --
  // this is the single shared modal behind Accept Reward/Penalty, Leave
  // Couple, Sign Out, Reset and more, so guarding it here covers all of them.
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
          {!!message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
          <PrimaryButton
            label={confirmLabel}
            onPress={handleConfirm}
            disabled={confirming}
            style={styles.button}
            colorOverride={danger ? { primary: colors.danger, textOnPrimary: colors.textOnPrimary } : undefined}
          />
          <PrimaryButton label={cancelLabel} onPress={onCancel} variant="outline" disabled={confirming} />
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
  message: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    marginBottom: spacing.sm,
  },
});
