import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { PartnerNudgeButton } from '../../components/common/PartnerNudgeButton';
import { usePlanning } from '../../store/PlanningContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { PlanBucket, PlanItemKind } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanBoard'>;

const BUCKETS: PlanBucket[] = ['today', 'week', 'month', 'someday'];
const KINDS: PlanItemKind[] = ['date', 'task', 'goal', 'purchase', 'trip', 'event'];

export const PlanBoardBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const planning = usePlanning();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PlanItemKind>('date');
  const [bucket, setBucket] = useState<PlanBucket>('today');

  const handleAdd = () => {
    if (!title.trim()) return;
    haptics.confirm();
    planning.addPlanItem({ title: title.trim(), kind, bucket });
    setTitle('');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('planBoard.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <View style={styles.chipRow}>
            {KINDS.map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[
                  styles.chip,
                  {
                    borderColor: kind === k ? colors.primary : colors.border,
                    backgroundColor: kind === k ? colors.background : colors.card,
                    borderWidth: kind === k ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`planBoard.kind_${k}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            {BUCKETS.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBucket(b)}
                style={[
                  styles.chip,
                  {
                    borderColor: bucket === b ? colors.primary : colors.border,
                    backgroundColor: bucket === b ? colors.background : colors.card,
                    borderWidth: bucket === b ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`planBoard.bucket_${b}`)}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label={t('planBoard.addButton')} onPress={handleAdd} disabled={!title.trim()} />
        </View>

        {planning.planItems.length === 0 ? (
          <EmptyState icon="goal" title={t('planBoard.emptyTitle')} description={t('planBoard.emptyDescription')} />
        ) : (
          BUCKETS.map((b) => {
            const items = planning.planItems.filter((p) => p.bucket === b);
            if (items.length === 0) return null;
            return (
              <View key={b} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t(`planBoard.bucket_${b}`)}</Text>
                {items.map((item) => (
                  <View key={item.id} style={[styles.item, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Pressable onPress={() => planning.setPlanItemDone(item.id, !item.done)} style={styles.itemPressableRow}>
                      <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: item.done ? colors.primary : 'transparent' }]} />
                      <View style={styles.itemBody}>
                        <Text
                          style={[
                            styles.itemTitle,
                            { color: colors.text, textDecorationLine: item.done ? 'line-through' : 'none' },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text style={[styles.itemKind, { color: colors.textSecondary }]}>{t(`planBoard.kind_${item.kind}`)}</Text>
                        {!item.done && <PartnerNudgeButton entityType="plan_item" entityId={item.id} title={item.title} />}
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
  );
};

export const PlanBoardScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('planBoard.title')} onBack={() => navigation.goBack()} />
      <PlanBoardBody />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  item: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemPressableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: spacing.sm,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  itemKind: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
