import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { ErrorState } from '../../components/common/ErrorState';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { Avatar } from '../../components/common/Avatar';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useAppStore } from '../../store/AppContext';
import * as accountService from '../../services/supabase/accountService';
import * as blockedUsersService from '../../services/supabase/blockedUsersService';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;
type AuthMode = 'signIn' | 'signUp';
type EditField = 'name' | 'avatar' | 'email' | 'password' | null;

const AVATAR_IDS = Array.from({ length: 10 }, (_, i) => i + 1);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export const AccountScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useCoupleSync();
  const { language } = useAppStore();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [joiningCode, setJoiningCode] = useState(false);

  const [editField, setEditField] = useState<EditField>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fieldSuccess, setFieldSuccess] = useState<string | null>(null);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmLeaveCouple, setConfirmLeaveCouple] = useState(false);
  const [confirmLeaveCoupleFinal, setConfirmLeaveCoupleFinal] = useState(false);
  const [blockStatus, setBlockStatus] = useState<'idle' | 'blocking' | 'error'>('idle');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const respondToReward = async (id: string, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(id);
    try {
      await sync.respondRewardRequest(id, accept);
    } finally {
      setRespondingId(null);
    }
  };

  const respondToPenalty = async (id: string, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(id);
    try {
      await sync.respondPenalty(id, accept);
    } finally {
      setRespondingId(null);
    }
  };

  const openEdit = (field: EditField, initial = '') => {
    setEditField(field);
    setFieldValue(initial);
    setFieldError(null);
    setFieldSuccess(null);
  };

  const closeEdit = () => {
    setEditField(null);
    setFieldValue('');
  };

  const handleSaveField = async () => {
    if (!editField) return;
    setFieldLoading(true);
    setFieldError(null);
    try {
      if (editField === 'name') {
        await auth.updateProfile({ name: fieldValue.trim() });
        setFieldSuccess('Имя обновлено');
      } else if (editField === 'email') {
        await accountService.updateEmail(fieldValue.trim());
        setFieldSuccess('Проверьте почту, чтобы подтвердить новый email');
      } else if (editField === 'password') {
        await accountService.updatePassword(fieldValue);
        setFieldSuccess('Пароль обновлён');
      }
      haptics.success();
      if (editField !== 'email') {
        setTimeout(closeEdit, 900);
      }
    } catch (e) {
      haptics.error();
      setFieldError(friendlyMessage(toServiceError(e)));
    } finally {
      setFieldLoading(false);
    }
  };

  const handlePickAvatar = async (avatarId: number) => {
    haptics.select();
    setFieldLoading(true);
    setFieldError(null);
    try {
      await auth.updateProfile({ selectedAvatar: avatarId });
      closeEdit();
    } catch (e) {
      setFieldError(friendlyMessage(toServiceError(e)));
    } finally {
      setFieldLoading(false);
    }
  };

  const handleSignOut = async () => {
    haptics.confirm();
    setConfirmSignOut(false);
    await auth.signOut();
    // Auth is required to reach Main -- send the user back through Splash,
    // which will now correctly route to Welcome.
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  const handleLeaveCouple = async () => {
    setConfirmLeaveCoupleFinal(false);
    haptics.confirm();
    const ok = await sync.leaveCouple();
    // Pairing is required to reach Main -- send the user back through
    // Splash, which will now correctly route to ConnectPartner.
    if (ok) navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  const handleBlockPartner = async () => {
    if (!sync.partner) return;
    setBlockStatus('blocking');
    try {
      await blockedUsersService.blockUser(sync.partner.id);
      haptics.success();
      setBlockStatus('idle');
    } catch {
      haptics.error();
      setBlockStatus('error');
    }
  };

  const submitAuth = () => {
    if (mode === 'signUp') {
      auth.signUp(email.trim(), password, name.trim() || 'Ты', language);
    } else {
      auth.signIn(email.trim(), password);
    }
  };

  const handleCreateCode = async () => {
    if (creatingCode) return;
    setCreatingCode(true);
    try {
      const code = await sync.createCoupleCode();
      if (code) setCreatedCode(code);
    } finally {
      setCreatingCode(false);
    }
  };

  const handleJoinCode = async () => {
    if (!joinCode.trim() || joiningCode) return;
    setJoiningCode(true);
    try {
      await sync.joinCoupleByCode(joinCode);
    } finally {
      setJoiningCode(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Аккаунт и синхронизация" onBack={() => navigation.goBack()} />

        {!auth.configured && (
          <ErrorState
            title="Backend не настроен"
            message="Добавьте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY в .env (см. supabase/README.md) и перезапустите приложение."
          />
        )}

        {auth.configured && auth.loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {auth.configured && !auth.loading && !auth.session && (
          <View>
            {auth.error && <BackendStatusBanner message={auth.error} onRetry={submitAuth} />}
            <View style={styles.modeRow}>
              <PrimaryButton
                label="Вход"
                onPress={() => setMode('signIn')}
                variant={mode === 'signIn' ? 'primary' : 'outline'}
                style={styles.modeButton}
              />
              <PrimaryButton
                label="Регистрация"
                onPress={() => setMode('signUp')}
                variant={mode === 'signUp' ? 'primary' : 'outline'}
                style={styles.modeButton}
              />
            </View>
            {mode === 'signUp' && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Имя"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Пароль"
              secureTextEntry
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            />
            <PrimaryButton
              label={mode === 'signUp' ? 'Зарегистрироваться' : 'Войти'}
              onPress={submitAuth}
              disabled={!email.trim() || !password}
            />
          </View>
        )}

        {auth.configured && !auth.loading && auth.session && (
          <View>
            <Text style={[styles.signedInAs, { color: colors.textSecondary }]}>
              Вы вошли как {auth.session.user.email}
            </Text>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Управление аккаунтом</Text>
              <View style={styles.editRow}>
                <PrimaryButton label="Изменить имя" onPress={() => openEdit('name')} variant="outline" style={styles.editButton} />
              </View>
              <View style={styles.editRow}>
                <PrimaryButton label="Изменить email" onPress={() => openEdit('email')} variant="outline" style={styles.editButton} />
                <PrimaryButton label="Изменить пароль" onPress={() => openEdit('password')} variant="outline" style={styles.editButton} />
              </View>
              <Pressable onPress={() => navigation.navigate('Security')} style={styles.securityLinkRow}>
                <Text style={[styles.linkAction, { color: colors.primary }]}>Восстановление и безопасность →</Text>
              </Pressable>
            </View>

            {sync.error && <ErrorState message={sync.error} onRetry={sync.refresh} />}
            {sync.loading && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!sync.loading && !sync.couple && (
              <View>
                {createdCode ? (
                  <View style={[styles.codeBox, { borderColor: colors.primary, backgroundColor: colors.card }]}>
                    <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Ваш код пары</Text>
                    <Text style={[styles.codeText, { color: colors.primary }]}>{createdCode}</Text>
                  </View>
                ) : (
                  <PrimaryButton
                    label="Создать код"
                    onPress={handleCreateCode}
                    loading={creatingCode}
                    style={styles.actionButton}
                  />
                )}

                <TextInput
                  value={joinCode}
                  onChangeText={(v) => setJoinCode(v.toUpperCase())}
                  placeholder="Код партнёра"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                />
                <PrimaryButton
                  label="Ввести код партнёра"
                  onPress={handleJoinCode}
                  disabled={!joinCode.trim()}
                  loading={joiningCode}
                />
              </View>
            )}

            {!sync.loading && sync.couple && (
              <View>
                <View style={[styles.pointsCard, shadow.soft, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.pointsValue, { color: colors.textOnPrimary }]}>{sync.couple.points}</Text>
                  <Text style={[styles.pointsLabel, { color: colors.textOnPrimary }]}>
                    Баллы пары (live){sync.pendingRequestsCount > 0 ? ` · ${sync.pendingRequestsCount} новых запросов` : ''}
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Партнёр</Text>
                  {sync.partner ? (
                    <>
                      <View style={[styles.partnerRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Avatar role={sync.partner.role ?? 'male'} avatarId={sync.partner.selected_avatar} size={48} />
                        <Text style={[styles.partnerName, { color: colors.text }]}>{sync.partner.name}</Text>
                      </View>
                      <View style={styles.partnerActionsRow}>
                        <Pressable onPress={handleBlockPartner} disabled={blockStatus === 'blocking'}>
                          <Text style={[styles.linkAction, { color: colors.danger }]}>
                            {blockStatus === 'blocking' ? 'Блокирую…' : 'Заблокировать партнёра'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => navigation.navigate('ReportUser', { userId: sync.partner!.id })}>
                          <Text style={[styles.linkAction, { color: colors.textSecondary }]}>Пожаловаться</Text>
                        </Pressable>
                      </View>
                      {blockStatus === 'error' && (
                        <Text style={[styles.blockError, { color: colors.danger }]}>Не удалось заблокировать. Попробуйте ещё раз.</Text>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>
                      Ждём, пока партнёр введёт код пары: {sync.couple.code}
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Пара</Text>
                  <View style={[styles.partnerRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.coupleMeta}>
                      <Text style={[styles.empty, { color: colors.textSecondary }]}>Подключена: {formatDate(sync.couple.created_at)}</Text>
                      <Text style={[styles.empty, { color: colors.textSecondary }]}>
                        Статус: {sync.partner ? 'Активна' : 'Ожидание партнёра'}
                      </Text>
                    </View>
                  </View>
                  <PrimaryButton
                    label="Отключить пару"
                    onPress={() => setConfirmLeaveCouple(true)}
                    variant="outline"
                    colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
                    style={styles.leaveCoupleButton}
                  />
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Последние действия</Text>
                  {sync.actionsList.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>Пока нет действий</Text>
                  ) : (
                    sync.actionsList.slice(0, 5).map((item) => (
                      <View key={item.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.rowPoints, { color: item.points >= 0 ? colors.success : colors.danger }]}>
                          {item.points >= 0 ? '+' : ''}
                          {item.points}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {sync.rewardRequests.filter((r) => r.status === 'pending').length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Запросы наград</Text>
                    {sync.rewardRequests
                      .filter((r) => r.status === 'pending')
                      .map((r) => (
                        <View key={r.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.rowTitle, { color: colors.text }]}>
                            {r.title} — {r.cost} баллов
                          </Text>
                          <View style={styles.cardActions}>
                            <PrimaryButton
                              label="Принять"
                              onPress={() => respondToReward(r.id, true)}
                              loading={respondingId === r.id}
                              disabled={!!respondingId && respondingId !== r.id}
                              style={styles.cardActionButton}
                            />
                            <PrimaryButton
                              label="Отклонить"
                              onPress={() => respondToReward(r.id, false)}
                              variant="outline"
                              disabled={!!respondingId}
                              style={styles.cardActionButton}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                )}

                {sync.penalties.filter((p) => p.status === 'pending').length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Штрафы на подтверждении</Text>
                    {sync.penalties
                      .filter((p) => p.status === 'pending')
                      .map((p) => (
                        <View key={p.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.rowTitle, { color: colors.text }]}>
                            {p.title} — -{p.points} баллов
                          </Text>
                          <View style={styles.cardActions}>
                            <PrimaryButton
                              label="Подтвердить"
                              onPress={() => respondToPenalty(p.id, true)}
                              loading={respondingId === p.id}
                              disabled={!!respondingId && respondingId !== p.id}
                              style={styles.cardActionButton}
                            />
                            <PrimaryButton
                              label="Отклонить"
                              onPress={() => respondToPenalty(p.id, false)}
                              variant="outline"
                              disabled={!!respondingId}
                              style={styles.cardActionButton}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )}

            <PrimaryButton label="Выйти" onPress={() => setConfirmSignOut(true)} variant="outline" style={styles.signOutButton} />
            <PrimaryButton
              label="Удалить аккаунт"
              onPress={() => navigation.navigate('DeleteAccount')}
              variant="outline"
              colorOverride={{ primary: colors.danger, textOnPrimary: colors.textOnPrimary }}
              style={styles.deleteAccountButton}
            />
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={confirmSignOut}
        title="Выйти из аккаунта?"
        message="Локальные данные на этом устройстве останутся без изменений — выходит только облачная сессия."
        confirmLabel="Выйти"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />

      <ConfirmationModal
        visible={confirmLeaveCouple}
        title="Отключить пару?"
        message="Пара будет полностью разорвана для обеих сторон: старый код приглашения станет недействительным, и вы с партнёром больше не будете видеть новые действия и данные друг друга. Прошлая общая история останется у каждого."
        confirmLabel="Продолжить"
        danger
        onConfirm={() => {
          setConfirmLeaveCouple(false);
          setConfirmLeaveCoupleFinal(true);
        }}
        onCancel={() => setConfirmLeaveCouple(false)}
      />

      <ConfirmationModal
        visible={confirmLeaveCoupleFinal}
        title="Точно отключить?"
        message="Это последнее подтверждение. Пара будет отключена немедленно для вас и для партнёра."
        confirmLabel="Отключить пару"
        danger
        onConfirm={handleLeaveCouple}
        onCancel={() => setConfirmLeaveCoupleFinal(false)}
      />

      <Modal visible={editField === 'avatar'} transparent animationType="fade" onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Выберите аватар</Text>
            {fieldError && <Text style={[styles.fieldStatus, { color: colors.danger }]}>{fieldError}</Text>}
            <FlatList
              data={AVATAR_IDS}
              keyExtractor={(id) => String(id)}
              numColumns={5}
              columnWrapperStyle={styles.avatarRow}
              renderItem={({ item }) => (
                <Pressable onPress={() => handlePickAvatar(item)} disabled={fieldLoading}>
                  <Avatar
                    role={auth.profile?.role ?? 'male'}
                    avatarId={item}
                    size={56}
                    selected={item === auth.profile?.selected_avatar}
                    showCheck
                  />
                </Pressable>
              )}
            />
            <PrimaryButton label="Закрыть" onPress={closeEdit} variant="outline" style={styles.modalButton} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!editField && editField !== 'avatar'} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.soft, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editField === 'name' && 'Изменить имя'}
              {editField === 'email' && 'Изменить email'}
              {editField === 'password' && 'Изменить пароль'}
            </Text>
            <TextInput
              value={fieldValue}
              onChangeText={setFieldValue}
              placeholder={editField === 'name' ? 'Имя' : editField === 'email' ? 'Новый email' : 'Новый пароль'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize={editField === 'email' ? 'none' : 'sentences'}
              keyboardType={editField === 'email' ? 'email-address' : 'default'}
              secureTextEntry={editField === 'password'}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            {fieldError && <Text style={[styles.fieldStatus, { color: colors.danger }]}>{fieldError}</Text>}
            {fieldSuccess && <Text style={[styles.fieldStatus, { color: colors.success }]}>{fieldSuccess}</Text>}
            {fieldLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <PrimaryButton
                label="Сохранить"
                onPress={handleSaveField}
                disabled={!fieldValue.trim()}
                style={styles.modalButton}
              />
            )}
            <PrimaryButton label="Отмена" onPress={closeEdit} variant="outline" />
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
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    height: 44,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  signedInAs: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  codeBox: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  codeLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  codeText: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    letterSpacing: 4,
  },
  pointsCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  pointsLabel: {
    fontSize: fontSize.sm,
    opacity: 0.9,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: fontSize.sm,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  partnerName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  coupleMeta: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  rowPoints: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cardActionButton: {
    flex: 1,
    height: 44,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
  deleteAccountButton: {
    marginTop: spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editButton: {
    flex: 1,
    height: 44,
  },
  securityLinkRow: {
    marginTop: spacing.xs,
  },
  partnerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  linkAction: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  blockError: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  leaveCoupleButton: {
    marginTop: spacing.sm,
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
  modalButton: {
    marginBottom: spacing.sm,
  },
  avatarRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  fieldStatus: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
  },
});
