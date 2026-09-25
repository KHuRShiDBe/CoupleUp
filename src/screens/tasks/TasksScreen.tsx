import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { PartnerNudgeButton } from '../../components/common/PartnerNudgeButton';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { DbTask } from '../../types/database';
import { TaskAssignee } from '../../types';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;

export const TasksScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useCoupleSync();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsValue, setPointsValue] = useState('10');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');
  const [submitting, setSubmitting] = useState(false);

  const myId = auth.session?.user?.id ?? null;

  const ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
    me: t('tasks.assigneeMe'),
    partner: t('tasks.assigneePartner'),
    both: t('tasks.assigneeBoth'),
  };

  // `assignee` is stored CREATOR-relative ('me' = the creator only,
  // 'partner' = the creator's partner). Flip it to the current viewer's
  // perspective so a task assigned to me by my partner doesn't read as if it
  // were assigned to them.
  const assigneeLabelFor = (task: DbTask): string => {
    if (task.assignee === 'both') return ASSIGNEE_LABELS.both;
    const createdByMe = task.created_by === myId;
    if (createdByMe) return ASSIGNEE_LABELS[task.assignee];
    return task.assignee === 'me' ? ASSIGNEE_LABELS.partner : ASSIGNEE_LABELS.me;
  };

  const openCreate = () => {
    setTitle('');
    setDescription('');
    setPointsValue('10');
    setAssignee('both');
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await sync.createTask({
        title: title.trim(),
        description: description.trim(),
        points: Math.abs(parseInt(pointsValue, 10) || 0),
        assignee,
      });
      setShowCreate(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    haptics.success();
    await sync.completeTask(taskId);
  };

  const activeTasks = sync.tasks.filter((t2) => t2.status === 'active');
  const completedTasks = sync.tasks.filter((t2) => t2.status === 'completed');

  const renderActiveTask = (task: DbTask) => (
    <View key={task.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{task.title}</Text>
        <Text style={[styles.cardPoints, { color: colors.success }]}>+{task.points}</Text>
      </View>
      {!!task.description && (
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{task.description}</Text>
      )}
      <View style={styles.cardMetaRow}>
        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
          {t('tasks.createdByLabel', {
            who: task.created_by === myId ? t('tasks.createdByMe') : t('tasks.createdByPartner'),
          })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
          <Text style={[styles.statusText, { color: colors.primary }]}>{assigneeLabelFor(task)}</Text>
        </View>
      </View>
      <PrimaryButton label={t('tasks.completeButton')} onPress={() => handleComplete(task.id)} style={styles.cardButton} />
      {task.assignee !== 'me' || task.created_by !== myId ? (
        <PartnerNudgeButton entityType="task" entityId={task.id} title={task.title} />
      ) : null}
    </View>
  );

  const renderCompletedTask = (task: DbTask) => (
    <View
      key={task.id}
      style={[styles.card, styles.completedCard, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{task.title}</Text>
        <Text style={[styles.cardPoints, { color: colors.textSecondary }]}>+{task.points}</Text>
      </View>
      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{t('tasks.statusDone')}</Text>
    </View>
  );

  if (!auth.configured) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('tasks.title')} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={t('tasks.title')} onBack={() => navigation.goBack()} />
      {sync.loading && sync.tasks.length === 0 ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {!!sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}
          <PrimaryButton label={t('tasks.createTask')} onPress={openCreate} style={styles.createButton} />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('tasks.active')}</Text>
          {activeTasks.length === 0 ? (
            <EmptyState icon="tasks" title={t('tasks.emptyActiveTitle')} description={t('tasks.emptyActiveDescription')} />
          ) : (
            activeTasks.map(renderActiveTask)
          )}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>{t('tasks.completed')}</Text>
          {completedTasks.length === 0 ? (
            <EmptyState icon="tasks" title={t('tasks.emptyCompletedTitle')} />
          ) : (
            completedTasks.map(renderCompletedTask)
          )}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('tasks.modalTitle')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('tasks.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('tasks.descriptionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                styles.textArea,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
              ]}
            />
            <TextInput
              value={pointsValue}
              onChangeText={(v) => setPointsValue(v.replace(/[^0-9]/g, ''))}
              placeholder={t('tasks.pointsPlaceholder')}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <Text style={[styles.label, { color: colors.text }]}>{t('tasks.assigneeLabel')}</Text>
            <View style={styles.assigneeRow}>
              {(Object.keys(ASSIGNEE_LABELS) as TaskAssignee[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setAssignee(key)}
                  style={[
                    styles.assigneeButton,
                    {
                      borderColor: assignee === key ? colors.primary : colors.border,
                      backgroundColor: assignee === key ? colors.background : colors.card,
                      borderWidth: assignee === key ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.assigneeText, { color: colors.text }]}>{ASSIGNEE_LABELS[key]}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={t('tasks.create')}
              onPress={submitCreate}
              disabled={!title.trim() || submitting}
              loading={submitting}
              style={styles.modalButton}
            />
            <PrimaryButton label={t('tasks.cancel')} onPress={() => setShowCreate(false)} variant="outline" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  createButton: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  completedCard: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardPoints: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardMeta: {
    fontSize: fontSize.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cardButton: {
    height: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  assigneeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  assigneeButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  assigneeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  modalButton: {
    marginBottom: spacing.sm,
  },
});
