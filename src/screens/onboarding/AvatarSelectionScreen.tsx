import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { Avatar } from '../../components/common/Avatar';
import { useAppStore } from '../../store/AppContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'AvatarSelection'>;

const AVATAR_IDS = Array.from({ length: 10 }, (_, i) => i + 1);
const COLUMNS = 3;

export const AvatarSelectionScreen = ({ navigation }: Props) => {
  const { colors, role } = useTheme();
  const { actions } = useAppStore();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const pickAvatar = (id: number) => {
    haptics.select();
    setSelected(id);
  };

  const handleContinue = () => {
    if (!selected) return;
    actions.setAvatar(selected);
    navigation.navigate('Name');
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('avatarSelection.title')} onBack={() => navigation.goBack()} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('avatarSelection.subtitle')}</Text>
      <FlatList
        data={AVATAR_IDS}
        keyExtractor={(id) => String(id)}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Pressable onPress={() => pickAvatar(item)} style={styles.cell}>
            <Avatar role={role} avatarId={item} size={84} selected={selected === item} showCheck />
          </Pressable>
        )}
      />
      <PrimaryButton label={t('avatarSelection.continue')} onPress={handleContinue} disabled={!selected} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  grid: {
    paddingBottom: spacing.lg,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cell: {
    alignItems: 'center',
  },
});
