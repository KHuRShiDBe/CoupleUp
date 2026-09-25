import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { logo } from '../../constants/assets';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { IconImage } from '../../components/common/IconImage';

type Props = NativeStackScreenProps<RootStackParamList, 'AppIcon'>;

type IconOptionId = 'default' | 'blue' | 'pink' | 'minimal';

const OPTIONS: { id: IconOptionId; title: string; background: string }[] = [
  { id: 'default', title: 'Default CoupleUp', background: '#F5F9FF' },
  { id: 'blue', title: 'Blue', background: '#2F80ED' },
  { id: 'pink', title: 'Pink', background: '#EC5C8D' },
  { id: 'minimal', title: 'Minimal', background: '#E7E9EE' },
];

export const AppIconScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<IconOptionId>('default');

  return (
    <ScreenContainer>
      <ScreenHeader title="Иконка приложения" onBack={() => navigation.goBack()} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Возможность сменить иконку приложения появится в одном из следующих обновлений. Пока это только превью.
      </Text>

      <View style={styles.grid}>
        {OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Pressable key={option.id} onPress={() => setSelected(option.id)} style={styles.optionWrap}>
              <View
                style={[
                  styles.iconSwatch,
                  { backgroundColor: option.background, borderColor: isSelected ? colors.primary : colors.border },
                ]}
              >
                {option.id === 'default' ? (
                  <Image source={logo} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <IconImage name="pair" size={28} style={option.id === 'minimal' ? undefined : styles.whiteIcon} />
                )}
              </View>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionWrap: {
    width: '48%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconSwatch: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  whiteIcon: {
    tintColor: '#FFFFFF',
  },
  optionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
