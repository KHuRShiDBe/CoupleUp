import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { EmptyState } from '../../components/common/EmptyState';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { HowItWorksNote } from '../../components/common/HowItWorksNote';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useBudget } from '../../store/BudgetContext';
import { useBond } from '../../store/BondContext';
import { useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { formatBond } from '../../utils/bond';

type Props = NativeStackScreenProps<RootStackParamList, 'PurchaseRequests'>;

export const PurchaseRequestScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const budget = useBudget();
  const bond = useBond();

  const [title, setTitle] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [note, setNote] = useState('');
  const [counterDraftFor, setCounterDraftFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');

  const myId = auth.session?.user?.id;
  const nameFor = (userId: string) => (userId === myId ? t('promises.me') : sync.partner?.name ?? t('promises.partner'));

  const priceValue = parseFloat(priceUsd.replace(',', '.'));
  const valid = title.trim().length > 0 && Number.isFinite(priceValue) && priceValue > 0 && !!sync.partner;

  const handleSend = () => {
    if (!valid) return;
    haptics.confirm();
    budget.addPurchaseRequest({ title: title.trim(), priceUsd: priceValue, rateSnapshot: bond.pointsPerBond, note: note.trim() || undefined });
    setTitle('');
    setPriceUsd('');
    setNote('');
  };

  const handleRespond = (id: string, approve: boolean) => {
    haptics.success();
    budget.respondPurchaseRequest(id, approve ? 'approved' : 'declined');
  };

  const openCounterDraft = (requestId: string, currentPrice: number) => {
    setCounterDraftFor(requestId);
    setCounterPrice(String(currentPrice));
  };

  const submitCounter = (requestId: string) => {
    const value = parseFloat(counterPrice.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    haptics.confirm();
    budget.proposeCounterOffer(requestId, value);
    setCounterDraftFor(null);
    setCounterPrice('');
  };

  const respondToOffer = (offerId: string, accept: boolean) => {
    haptics.success();
    budget.respondCounterOffer(offerId, accept);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={t('purchaseRequests.title')} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!!budget.error && <BackendStatusBanner message={budget.error} onRetry={budget.clearError} />}
        <HowItWorksNote text={t('purchaseRequests.howItWorksText')} />

        <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('purchaseRequests.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <TextInput
            value={priceUsd}
            onChangeText={(v) => setPriceUsd(v.replace(/[^0-9.,]/g, ''))}
            placeholder={t('purchaseRequests.pricePlaceholder')}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          {Number.isFinite(priceValue) && priceValue > 0 && (
            <Text style={[styles.computed, { color: colors.primary }]}>
              ≈ {formatBond(bond.toBond(priceValue))} BOND · ≈ {Math.round(bond.toPoints(priceValue))} {t('bond.points')}
            </Text>
          )}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('purchaseRequests.notePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />
          <PrimaryButton label={t('purchaseRequests.sendButton')} onPress={handleSend} disabled={!valid} />
        </View>

        {budget.purchaseRequests.length === 0 ? (
          <EmptyState icon="shop" title={t('purchaseRequests.emptyTitle')} description={t('purchaseRequests.emptyDescription')} />
        ) : (
          budget.purchaseRequests.map((r) => {
            const activeOffer = budget.purchaseRequestOffers.find((o) => o.purchase_request_id === r.id && o.status === 'pending');
            const iAmRecipient = r.recipient_id === myId;
            const iAmRequester = r.requested_by === myId;
            const isDraftingCounter = counterDraftFor === r.id;

            return (
              <View key={r.id} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{r.title}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {nameFor(r.requested_by)} → {nameFor(r.recipient_id)}
                </Text>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>
                  {/* BOND amount == price_usd (fixed 1:1 peg); points use the RATE SNAPSHOT taken at
                      creation, not the current live rate, so approving later never changes what was asked. */}
                  ${r.price_usd.toFixed(2)} · ≈ {formatBond(r.price_usd)} BOND · ≈ {Math.round(r.price_usd * r.rate_snapshot)}{' '}
                  {t('bond.points')}
                </Text>
                {!!r.note && <Text style={[styles.cardNote, { color: colors.textSecondary }]}>{r.note}</Text>}
                <Text style={[styles.cardStatus, { color: colors.textSecondary }]}>{t(`purchaseRequests.status_${r.status}`)}</Text>

                {/* Active counter-offer: requester decides, recipient just sees it's pending. */}
                {activeOffer && r.status === 'pending' && (
                  <View style={[styles.offerBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.offerLabel, { color: colors.text }]}>
                      {t('purchaseRequests.counterOffer', { price: activeOffer.price_usd.toFixed(2) })}
                    </Text>
                    {iAmRequester ? (
                      <View style={styles.actionsRow}>
                        <PrimaryButton
                          label={t('purchaseRequests.acceptOffer')}
                          onPress={() => respondToOffer(activeOffer.id, true)}
                          style={styles.actionButton}
                        />
                        <PrimaryButton
                          label={t('purchaseRequests.declineOffer')}
                          onPress={() => respondToOffer(activeOffer.id, false)}
                          variant="outline"
                          style={styles.actionButton}
                        />
                      </View>
                    ) : (
                      <Text style={[styles.offerWaiting, { color: colors.textSecondary }]}>{t('purchaseRequests.offerWaiting')}</Text>
                    )}
                  </View>
                )}

                {r.status === 'pending' && iAmRecipient && !activeOffer && (
                  <>
                    <View style={styles.actionsRow}>
                      <PrimaryButton label={t('purchaseRequests.approve')} onPress={() => handleRespond(r.id, true)} style={styles.actionButton} />
                      <PrimaryButton
                        label={t('purchaseRequests.decline')}
                        onPress={() => handleRespond(r.id, false)}
                        variant="outline"
                        style={styles.actionButton}
                      />
                    </View>
                    {!isDraftingCounter ? (
                      <PrimaryButton
                        label={t('purchaseRequests.proposeCounter')}
                        onPress={() => openCounterDraft(r.id, r.price_usd)}
                        variant="outline"
                        style={styles.counterButton}
                      />
                    ) : (
                      <View style={styles.counterForm}>
                        <TextInput
                          value={counterPrice}
                          onChangeText={(v) => setCounterPrice(v.replace(/[^0-9.,]/g, ''))}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        />
                        <View style={styles.actionsRow}>
                          <PrimaryButton label={t('purchaseRequests.sendCounter')} onPress={() => submitCounter(r.id)} style={styles.actionButton} />
                          <PrimaryButton
                            label={t('common.cancel')}
                            onPress={() => setCounterDraftFor(null)}
                            variant="outline"
                            style={styles.actionButton}
                          />
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
  computed: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardPrice: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  cardNote: {
    fontSize: fontSize.xs,
    marginTop: 2,
    fontStyle: 'italic',
  },
  cardStatus: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 40,
  },
  counterButton: {
    marginTop: spacing.sm,
    height: 40,
  },
  counterForm: {
    marginTop: spacing.sm,
  },
  offerBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  offerLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  offerWaiting: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});
