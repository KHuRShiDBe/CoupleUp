import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useWishlist } from '../../store/WishlistContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { formatBond, formatUsd } from '../../utils/bond';
import { WishlistPriority } from '../../types';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Wishlist'>;

const PRIORITIES: WishlistPriority[] = ['low', 'medium', 'high'];

export const WishlistScreen = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const wishlist = useWishlist();
  const sync = useCoupleSync();
  // Wishes live on the couple -- without a paired couple there is nowhere to
  // save them, so say so instead of silently ignoring "Add".
  const hasCouple = !!sync.couple;
  const bond = useBond();

  // Optional filter from the two Home cards ("Мои желания" / "Желания
  // партнёра") -- same list, same table, just a client-side slice by
  // created_by. Entry points that don't pass `owner` (AllSections,
  // CoupleProfile) keep showing the combined list, unchanged.
  const owner = route.params?.owner;
  const myId = auth.session?.user?.id;
  const visibleItems = !owner
    ? wishlist.items
    : wishlist.items.filter((item) => (owner === 'me' ? item.created_by === myId : item.created_by !== myId));
  const screenTitle = owner === 'me' ? t('home.myWishes') : owner === 'partner' ? t('home.partnerWishes') : t('wishlist.title');

  const [title, setTitle] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [priority, setPriority] = useState<WishlistPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  const priorityColor = (p: WishlistPriority) =>
    p === 'high' ? colors.danger : p === 'medium' ? colors.primary : colors.textSecondary;
  const priorityLabel = (p: WishlistPriority) =>
    p === 'high' ? t('wishlist.priorityHigh') : p === 'medium' ? t('wishlist.priorityMedium') : t('wishlist.priorityLow');

  const handleAdd = async () => {
    const price = parseFloat(priceUsd.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(price) || price <= 0 || submitting) return;
    haptics.confirm();
    setSubmitting(true);
    try {
      // Keep what the user typed if saving failed.
      const saved = await wishlist.addItem({ title: title.trim(), priceUsd: price, priority });
      if (saved) {
        setTitle('');
        setPriceUsd('');
        setPriority('medium');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.configured) {
    return (
      <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
        <ErrorState message={t('activityCenter.notConfigured')} />
      </ScreenContainer></ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!wishlist.error && <BackendStatusBanner message={wishlist.error} onRetry={wishlist.clearError} />}
        {!hasCouple && <BackendStatusBanner message={t('compliments.noPartner')} />}
        {owner !== 'partner' && (
          <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('wishlist.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={priceUsd}
              onChangeText={(v) => setPriceUsd(v.replace(/[^0-9.,]/g, ''))}
              placeholder={t('wishlist.pricePlaceholder')}
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
                  <Text style={[styles.priorityChipText, { color: priorityColor(p) }]}>{priorityLabel(p)}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={t('wishlist.addButton')}
              onPress={handleAdd}
              disabled={!hasCouple || !title.trim() || !priceUsd.trim() || submitting}
              loading={submitting}
            />
          </View>
        )}

        {wishlist.loading && wishlist.items.length === 0 ? (
          <LoadingState />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon="goal" title={t('wishlist.emptyTitle')} description={t('wishlist.emptyDescription')} />
        ) : (
          visibleItems.map((item) => {
            const priceUsdValue = item.price_usd ?? 0;
            const points = bond.toPoints(priceUsdValue);
            return (
              <View
                key={item.id}
                style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.priorityBadge, { backgroundColor: priorityColor(item.priority) }]}>
                    <Text style={styles.priorityBadgeText}>{priorityLabel(item.priority)}</Text>
                  </View>
                </View>
                {item.price_usd != null && (
                  <>
                    <Text style={[styles.cardPrice, { color: colors.primary }]}>${priceUsdValue.toFixed(2)}</Text>
                    <Text style={[styles.cardEquivalent, { color: colors.textSecondary }]}>
                      ≈ {formatBond(bond.toBond(priceUsdValue))} BOND · ≈ {Math.round(points)} {t('bond.points')}
                    </Text>
                  </>
                )}
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {item.created_by === auth.session?.user?.id ? t('promises.me') : t('promises.partner')}
                </Text>
                {item.created_by === auth.session?.user?.id && (
                  <Pressable onPress={() => wishlist.removeItem(item.id)} style={styles.removeButton}>
                    <Text style={[styles.removeButtonText, { color: colors.danger }]}>{t('wishlist.remove')}</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer></ScreenBackground>
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
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  priorityChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityChipText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
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
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  priorityBadgeText: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
    fontWeight: '700',
    color: '#fff',
  },
  cardPrice: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  cardEquivalent: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
