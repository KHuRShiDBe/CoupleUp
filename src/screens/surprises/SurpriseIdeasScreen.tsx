import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import * as planningService from '../../services/supabase/planningService';
import { DbSurpriseIdea, SurprisePriority } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'SurpriseIdeas'>;

const PRIORITIES: SurprisePriority[] = ['low', 'medium', 'high'];

// PRIVATE: RLS on public.surprise_ideas (migration 0011) only ever returns
// rows where author_id = auth.uid() -- the partner can never see this list,
// server-side, regardless of what this screen does. That's why this screen
// fetches directly rather than through the couple-shared PlanningContext.
export const SurpriseIdeasBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const [ideas, setIdeas] = useState<DbSurpriseIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [priority, setPriority] = useState<SurprisePriority>('medium');

  const load = () => {
    setLoading(true);
    planningService
      .listSurpriseIdeas()
      .then(setIdeas)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priorityColor = (p: SurprisePriority) => (p === 'high' ? colors.danger : p === 'medium' ? colors.primary : colors.textSecondary);

  const handleAdd = async () => {
    if (!title.trim() || !sync.couple || !auth.session?.user) return;
    haptics.confirm();
    const price = priceUsd ? parseFloat(priceUsd.replace(',', '.')) : undefined;
    await planningService.addSurpriseIdea({
      coupleId: sync.couple.id,
      authorId: auth.session.user.id,
      title: title.trim(),
      note: note.trim() || undefined,
      priceUsd: Number.isFinite(price) ? price : undefined,
      priority,
    });
    setTitle('');
    setNote('');
    setPriceUsd('');
    setPriority('medium');
    load();
  };

  const handleDelete = async (id: string) => {
    haptics.select();
    await planningService.deleteSurpriseIdea(id);
    load();
  };

  return (
    <>
      <Text style={[styles.privacyNote, { color: colors.textSecondary }]}>{t('surprises.privacyNote')}</Text>
      {loading ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('surprises.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('surprises.notePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={priceUsd}
              onChangeText={(v) => setPriceUsd(v.replace(/[^0-9.,]/g, ''))}
              placeholder={t('surprises.pricePlaceholderOptional')}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityChip,
                    {
                      borderColor: priority === p ? priorityColor(p) : colors.border,
                      backgroundColor: priority === p ? colors.background : colors.card,
                      borderWidth: priority === p ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.priorityChipText, { color: priorityColor(p) }]}>{t(`surprises.priority_${p}`)}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label={t('surprises.addButton')} onPress={handleAdd} disabled={!title.trim()} />
          </View>

          {ideas.length === 0 ? (
            <EmptyState icon="goal" title={t('surprises.emptyTitle')} description={t('surprises.emptyDescription')} />
          ) : (
            ideas.map((idea) => (
              <View key={idea.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {idea.title}
                  </Text>
                  <View style={[styles.priorityBadge, { backgroundColor: priorityColor(idea.priority) }]}>
                    <Text style={styles.priorityBadgeText}>{t(`surprises.priority_${idea.priority}`)}</Text>
                  </View>
                </View>
                {!!idea.note && <Text style={[styles.cardNote, { color: colors.textSecondary }]}>{idea.note}</Text>}
                {idea.price_usd != null && <Text style={[styles.cardPrice, { color: colors.primary }]}>${idea.price_usd.toFixed(2)}</Text>}
                <Pressable onPress={() => handleDelete(idea.id)} style={styles.removeButton}>
                  <Text style={[styles.removeButtonText, { color: colors.danger }]}>{t('surprises.remove')}</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </>
  );
};

export const SurpriseIdeasScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('surprises.title')} onBack={() => navigation.goBack()} />
      <SurpriseIdeasBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  privacyNote: {
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  form: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  priorityChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  cardNote: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  cardPrice: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  removeButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  removeButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
