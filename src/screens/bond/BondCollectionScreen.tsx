import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTranslation } from '../../localization/useTranslation';
import { BOND_DENOMINATIONS } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'BondCollection'>;

// Purely visual -- no purchase, no real payment, no bank logic. Just a
// denomination showcase for CoupleUp's internal points currency.
export const BondCollectionScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <ScreenHeader title={t('bond.collectionTitle')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('bond.collectionSubtitle')}</Text>
        <View style={styles.grid}>
          {BOND_DENOMINATIONS.map((value) => (
            <View
              key={value}
              style={[styles.note, shadow.soft, { backgroundColor: colors.primary, borderColor: colors.border }]}
            >
              <Text style={[styles.noteValue, { color: colors.textOnPrimary }]}>{value}</Text>
              <Text style={[styles.noteLabel, { color: colors.textOnPrimary }]}>BOND</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  note: {
    width: '47%',
    aspectRatio: 1.6,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  noteLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
