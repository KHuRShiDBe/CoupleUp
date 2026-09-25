import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'FairSplit'>;

const PRESETS: { key: string; a: number }[] = [
  { key: '50/50', a: 50 },
  { key: '60/40', a: 60 },
  { key: '70/30', a: 70 },
];

export const FairSplitBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const bond = useBond();

  const [amount, setAmount] = useState('');
  const [splitA, setSplitA] = useState(50);
  const [customA, setCustomA] = useState('50');
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');

  const total = parseFloat(amount.replace(',', '.'));
  const validTotal = Number.isFinite(total) && total > 0;
  const percentA = mode === 'custom' ? Math.min(100, Math.max(0, parseFloat(customA) || 0)) : splitA;
  const shareA = validTotal ? (total * percentA) / 100 : 0;
  const shareB = validTotal ? total - shareA : 0;

  const myName = t('promises.me');
  const partnerName = sync.partner?.name ?? t('promises.partner');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
            placeholder={t('fairSplit.amountPlaceholder')}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <View style={styles.chipRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => {
                  setMode('preset');
                  setSplitA(p.a);
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: mode === 'preset' && splitA === p.a ? colors.primary : colors.border,
                    backgroundColor: mode === 'preset' && splitA === p.a ? colors.background : colors.card,
                    borderWidth: mode === 'preset' && splitA === p.a ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{p.key}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setMode('custom')}
              style={[
                styles.chip,
                {
                  borderColor: mode === 'custom' ? colors.primary : colors.border,
                  backgroundColor: mode === 'custom' ? colors.background : colors.card,
                  borderWidth: mode === 'custom' ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>{t('fairSplit.custom')}</Text>
            </Pressable>
          </View>
          {mode === 'custom' && (
            <TextInput
              value={customA}
              onChangeText={(v) => setCustomA(v.replace(/[^0-9]/g, ''))}
              placeholder={t('fairSplit.customPlaceholder', { name: myName })}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
          )}
        </View>

        {validTotal && (
          <View style={[styles.resultCard, shadow.soft, { backgroundColor: colors.primary }]}>
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={[styles.resultName, { color: colors.textOnPrimary }]}>{myName}</Text>
                <Text style={[styles.resultValue, { color: colors.textOnPrimary }]}>${shareA.toFixed(2)}</Text>
                <Text style={[styles.resultBond, { color: colors.textOnPrimary }]}>≈ {formatBond(bond.toBond(shareA))} BOND</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={[styles.resultName, { color: colors.textOnPrimary }]}>{partnerName}</Text>
                <Text style={[styles.resultValue, { color: colors.textOnPrimary }]}>${shareB.toFixed(2)}</Text>
                <Text style={[styles.resultBond, { color: colors.textOnPrimary }]}>≈ {formatBond(bond.toBond(shareB))} BOND</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
  );
};

export const FairSplitScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('fairSplit.title')} onBack={() => navigation.goBack()} />
      <FairSplitBody />
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
  },
  chip: {
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    opacity: 0.9,
  },
  resultValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  resultBond: {
    fontSize: fontSize.xs,
    marginTop: 2,
    opacity: 0.85,
  },
});
