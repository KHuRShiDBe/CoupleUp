import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Avatar } from '../../components/common/Avatar';
import { StatCard } from '../../components/cards/StatCard';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { LoadingState } from '../../components/common/LoadingState';
import { useMockLoading } from '../../hooks/useMockLoading';
import { useAppStore } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { uploadProfilePhoto } from '../../services/supabase/photoService';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { t } = useTranslation();
  const loading = useMockLoading();
  const { userName, selectedAvatar } = useAppStore();
  const auth = useAuth();
  const sync = useCoupleSync();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const partnerRole = sync.partner?.role ?? (role === 'male' ? 'female' : 'male');
  const daysTogether = sync.couple ? Math.floor((Date.now() - new Date(sync.couple.created_at).getTime()) / 86400000) : null;
  const myId = auth.session?.user?.id;

  const handleChangePhoto = async () => {
    if (!myId || photoBusy) return;
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError(t('profile.photoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    haptics.confirm();
    setPhotoBusy(true);
    try {
      const url = await uploadProfilePhoto(myId, result.assets[0].uri);
      await auth.updateProfile({ photoUrl: url });
    } catch {
      setPhotoError(t('profile.photoUploadError'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleResetPhoto = async () => {
    haptics.select();
    await auth.updateProfile({ photoUrl: null });
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title={t('settings.profile')} onBack={() => navigation.goBack()} />
        <LoadingState lines={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={t('settings.profile')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.photoArea}>
          <Avatar role={role} avatarId={selectedAvatar} photoUrl={auth.profile?.photo_url} size={96} selected />
          {photoBusy && (
            <View style={styles.photoBusyOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
        <View style={styles.photoButtonsRow}>
          <PrimaryButton
            label={t('profile.changePhoto')}
            onPress={handleChangePhoto}
            variant="outline"
            disabled={photoBusy}
            style={styles.photoButton}
          />
          {!!auth.profile?.photo_url && (
            <PrimaryButton
              label={t('profile.resetPhoto')}
              onPress={handleResetPhoto}
              variant="outline"
              disabled={photoBusy}
              style={styles.photoButton}
            />
          )}
        </View>
        {!!photoError && <Text style={[styles.photoError, { color: colors.danger }]}>{photoError}</Text>}

        <View style={[styles.partnerCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar role={partnerRole} avatarId={sync.partner?.selected_avatar ?? null} photoUrl={sync.partner?.photo_url} size={56} />
          <View style={styles.partnerInfo}>
            <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>
              {sync.partner?.name ?? t('profile.notConnected')}
            </Text>
            <Text style={[styles.partnerStatus, { color: colors.textSecondary }]}>
              {sync.couple
                ? daysTogether === null || daysTogether === 0
                  ? t('profile.togetherToday')
                  : t('profile.together', { days: daysTogether })
                : t('profile.notConnected')}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate('Finance')} style={styles.statsRow}>
          <StatCard label={t('profile.points')} value={sync.myStats.balance} emphasis />
          <StatCard label={t('profile.earned')} value={sync.myStats.earned} />
          <StatCard label={t('profile.spent')} value={sync.myStats.spent} />
        </Pressable>

        <PrimaryButton
          label={t('profile.settings')}
          onPress={() => navigation.navigate('Settings')}
          variant="outline"
          style={styles.settingsButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  photoArea: {
    marginTop: spacing.lg,
  },
  photoBusyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  photoButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  photoError: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  partnerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  partnerName: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  partnerStatus: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.lg,
  },
  settingsButton: {
    width: '100%',
  },
});
