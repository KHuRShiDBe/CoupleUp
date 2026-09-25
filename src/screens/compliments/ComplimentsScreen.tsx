import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Compliments'>;

const COMPLIMENT_KEYS: { key: TranslationKey; points: number }[] = [
  { key: 'compliments.c1', points: 1 },
  { key: 'compliments.c2', points: 2 },
  { key: 'compliments.c3', points: 2 },
  { key: 'compliments.c4', points: 1 },
  { key: 'compliments.c5', points: 1 },
];

export const ComplimentsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const [sentKey, setSentKey] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleSend = async (key: TranslationKey, points: number) => {
    if (submittingRef.current || !sync.partner) return;
    submittingRef.current = true;
    haptics.confirm();
    await sync.addAction(t(key), points, sync.partner.id, 'compliment');
    submittingRef.current = false;
    setSentKey(key);
    setTimeout(() => setSentKey(null), 1500);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('compliments.title')} onBack={() => navigation.goBack()} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('compliments.subtitle')}</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {COMPLIMENT_KEYS.map(({ key, points }) => (
          <Pressable
            key={key}
            onPress={() => handleSend(key, points)}
            disabled={!sync.partner}
            style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.cardText, { color: colors.text }]}>{t(key)}</Text>
            <View style={styles.cardRight}>
              <Text style={[styles.cardPoints, { color: colors.primary }]}>+{points}</Text>
              {sentKey === key && <Text style={[styles.sentLabel, { color: colors.success }]}>{t('compliments.sent')}</Text>}
            </View>
          </Pressable>
        ))}
        {!sync.partner && (
          <Text style={[styles.noPartner, { color: colors.textSecondary }]}>{t('compliments.noPartner')}</Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardPoints: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  sentLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  noPartner: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
