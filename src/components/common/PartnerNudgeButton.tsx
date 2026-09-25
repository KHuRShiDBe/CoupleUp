import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import * as nudgeService from '../../services/supabase/nudgeService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';
import { useTranslation } from '../../localization/useTranslation';

interface Props {
  entityType: string;
  entityId?: string | null;
  title: string;
}

// "Напомнить партнёру" -- a small, reusable soft-nudge button. Rate-limiting
// (max one nudge per entity per 6 hours) is enforced server-side by
// send_partner_nudge (migration 0015), so this component never needs its own
// spam guard beyond disabling itself while the request is in flight.
export const PartnerNudgeButton = ({ entityType, entityId, title }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sync = useCoupleSync();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!sync.couple || !sync.partner) return null;

  const handlePress = async () => {
    if (state === 'sending') return;
    haptics.select();
    setState('sending');
    setErrorMessage(null);
    try {
      await nudgeService.sendPartnerNudge({ coupleId: sync.couple!.id, entityType, entityId, title });
      setState('sent');
    } catch (e) {
      setErrorMessage(friendlyMessage(toServiceError(e)));
      setState('error');
    }
  };

  if (state === 'sent') {
    return <Text style={[styles.sentText, { color: colors.success }]}>{t('nudge.sent')}</Text>;
  }

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={state === 'sending'}
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.background, opacity: state === 'sending' ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>{t('nudge.button')}</Text>
      </Pressable>
      {state === 'error' && !!errorMessage && <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>}
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  buttonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sentText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
