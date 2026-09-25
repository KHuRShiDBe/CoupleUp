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
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond, formatUsd } from '../../utils/bond';
import { PayerMode } from '../../types/database';

type Props = NativeStackScreenProps<RootStackParamList, 'ShoppingList'>;

const PAYER_MODES: PayerMode[] = ['assigned', 'together', 'undetermined'];

export const ShoppingListBody = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const bond = useBond();

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priceUsd, setPriceUsd] = useState('');
  const [payerMode, setPayerMode] = useState<PayerMode>('undetermined');
  const [payerIsMe, setPayerIsMe] = useState(true);

  const nameFor = (userId: string | null) =>
    userId === auth.session?.user?.id ? t('promises.me') : userId ? sync.partner?.name ?? t('promises.partner') : null;

  const payerLabel = (item: { payer_mode: PayerMode; payer_user_id: string | null }) => {
    if (item.payer_mode === 'together') return t('shopping.payerTogether');
    if (item.payer_mode === 'undetermined') return t('shopping.payerUndetermined');
    return nameFor(item.payer_user_id) ?? t('shopping.payerUndetermined');
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    haptics.confirm();
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const price = priceUsd ? parseFloat(priceUsd.replace(',', '.')) : undefined;
    const payerUserId =
      payerMode === 'assigned' ? (payerIsMe ? auth.session?.user?.id : sync.partner?.id) : undefined;
    budget.addShoppingItem({
      title: title.trim(),
      quantity: qty,
      priceUsd: Number.isFinite(price as number) ? price : undefined,
      payerMode,
      payerUserId,
    });
    setTitle('');
    setQuantity('1');
    setPriceUsd('');
    setPayerMode('undetermined');
  };

  const notPurchased = budget.shoppingItems.filter((i) => !i.purchased);
  const purchased = budget.shoppingItems.filter((i) => i.purchased);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('shopping.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <View style={styles.row}>
            <TextInput
              value={quantity}
              onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
              placeholder={t('shopping.quantityPlaceholder')}
              keyboardType="number-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.smallInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={priceUsd}
              onChangeText={(v) => setPriceUsd(v.replace(/[^0-9.,]/g, ''))}
              placeholder={t('shopping.pricePlaceholderOptional')}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.flexInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('shopping.whoPays')}</Text>
          <View style={styles.chipRow}>
            {PAYER_MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setPayerMode(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: payerMode === m ? colors.primary : colors.border,
                    backgroundColor: payerMode === m ? colors.background : colors.card,
                    borderWidth: payerMode === m ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t(`shopping.payerMode_${m}`)}</Text>
              </Pressable>
            ))}
          </View>
          {payerMode === 'assigned' && (
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setPayerIsMe(true)}
                style={[styles.chip, { borderColor: payerIsMe ? colors.primary : colors.border, borderWidth: payerIsMe ? 2 : 1 }]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{t('promises.me')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setPayerIsMe(false)}
                style={[styles.chip, { borderColor: !payerIsMe ? colors.primary : colors.border, borderWidth: !payerIsMe ? 2 : 1 }]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{sync.partner?.name ?? t('promises.partner')}</Text>
              </Pressable>
            </View>
          )}
          <PrimaryButton label={t('shopping.addButton')} onPress={handleAdd} disabled={!title.trim()} />
        </View>

        {budget.shoppingItems.length === 0 ? (
          <EmptyState icon="shop" title={t('shopping.emptyTitle')} description={t('shopping.emptyDescription')} />
        ) : (
          <>
            {notPurchased.map((item) => (
              <View key={item.id} style={[styles.item, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable onPress={() => budget.setShoppingItemPurchased(item.id, true)} style={styles.itemPressableRow}>
                  <View style={[styles.checkbox, { borderColor: colors.primary }]} />
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {item.title} {item.quantity > 1 ? `× ${item.quantity}` : ''}
                    </Text>
                    <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                      {nameFor(item.added_by)} · {payerLabel(item)}
                    </Text>
                    {item.price_usd != null && (
                      <Text style={[styles.itemPrice, { color: colors.primary }]}>
                        ${item.price_usd.toFixed(2)} · ≈ {formatBond(bond.toBond(item.price_usd))} BOND
                      </Text>
                    )}
                    <PartnerNudgeButton entityType="shopping_item" entityId={item.id} title={item.title} />
                  </View>
                </Pressable>
              </View>
            ))}
            {purchased.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('shopping.purchasedTitle')}</Text>
                {purchased.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => budget.setShoppingItemPurchased(item.id, false)}
                    style={[styles.item, styles.itemPressableRow, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: colors.primary }]} />
                    <Text style={[styles.itemTitle, { color: colors.text, textDecorationLine: 'line-through' }]}>{item.title}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
  );
};

export const ShoppingListScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <ScreenHeader title={t('shopping.title')} onBack={() => navigation.goBack()} />
      <ShoppingListBody />
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallInput: {
    width: 70,
  },
  flexInput: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
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
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
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
  itemMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
});
