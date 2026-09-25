import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../store/AuthContext';
import { useAppStore } from '../../store/AppContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { usePlanning } from '../../store/PlanningContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Wants'>;

export const WantsBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { userName } = useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  const planning = usePlanning();
  const [wantText, setWantText] = useState('');
  const [dontWantText, setDontWantText] = useState('');

  const nameFor = (userId: string) => (userId === auth.session?.user?.id ? userName : sync.partner?.name ?? t('promises.partner'));

  const handleAddWant = () => {
    if (!wantText.trim()) return;
    haptics.confirm();
    planning.addWant('want', wantText.trim());
    setWantText('');
  };

  const handleAddDontWant = () => {
    if (!dontWantText.trim()) return;
    haptics.confirm();
    planning.addWant('dont_want', dontWantText.trim());
    setDontWantText('');
  };

  const wants = planning.wants.filter((w) => w.kind === 'want');
  const dontWants = planning.wants.filter((w) => w.kind === 'dont_want');

  return (
    <>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('wants.subtitle')}</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('wants.wantTitle')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={wantText}
            onChangeText={setWantText}
            placeholder={t('wants.wantPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          <PrimaryButton label={t('wants.addButton')} onPress={handleAddWant} disabled={!wantText.trim()} style={styles.addButton} />
        </View>
        {wants.length === 0 ? (
          <EmptyState icon="goal" title={t('wants.emptyWant')} description="" />
        ) : (
          wants.map((w) => (
            <View key={w.id} style={[styles.item, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.itemText, { color: colors.text }]}>{w.text}</Text>
              <Text style={[styles.itemAuthor, { color: colors.textSecondary }]}>{nameFor(w.user_id)}</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>{t('wants.dontWantTitle')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={dontWantText}
            onChangeText={setDontWantText}
            placeholder={t('wants.dontWantPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          />
          <PrimaryButton
            label={t('wants.addButton')}
            onPress={handleAddDontWant}
            disabled={!dontWantText.trim()}
            style={styles.addButton}
          />
        </View>
        {dontWants.length === 0 ? (
          <EmptyState icon="goal" title={t('wants.emptyDontWant')} description="" />
        ) : (
          dontWants.map((w) => (
            <View key={w.id} style={[styles.item, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.itemText, { color: colors.text }]}>{w.text}</Text>
              <Text style={[styles.itemAuthor, { color: colors.textSecondary }]}>{nameFor(w.user_id)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
};

export const WantsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('wants.title')} onBack={() => navigation.goBack()} />
      <WantsBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
  },
  addButton: {
    height: 44,
    paddingHorizontal: spacing.md,
  },
  item: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  itemAuthor: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
