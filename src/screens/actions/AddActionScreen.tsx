import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { FilterTabs } from '../../components/common/FilterTabs';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useCoupleOffers } from '../../store/CoupleOffersContext';
import { TranslationKey, useTranslation } from '../../localization/useTranslation';
import { haptics } from '../../utils/haptics';
import { FAILURE_PENALTY_MULTIPLIER } from '../../constants/coupleEconomyConfig';
import { DbCoupleOffer } from '../../types/database';

type Props = BottomTabScreenProps<MainTabParamList, 'Add'>;
type Direction = 'toPartner' | 'fromPartner';
type AddTab = 'quick' | 'offer';

const DEADLINE_PRESETS: { key: string; labelKey: TranslationKey; compute: () => Date }[] = [
  {
    key: 'tonight',
    labelKey: 'coupleOffers.deadlineTonight',
    compute: () => {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  { key: 'tomorrow', labelKey: 'coupleOffers.deadlineTomorrow', compute: () => new Date(Date.now() + 24 * 3600000) },
  { key: '3days', labelKey: 'coupleOffers.deadline3Days', compute: () => new Date(Date.now() + 3 * 24 * 3600000) },
  { key: 'week', labelKey: 'coupleOffers.deadlineWeek', compute: () => new Date(Date.now() + 7 * 24 * 3600000) },
];

const isOverdue = (offer: DbCoupleOffer): boolean =>
  offer.status === 'accepted' && !!offer.deadline && new Date(offer.deadline).getTime() < Date.now();

const statusLabel = (t: (key: TranslationKey, params?: Record<string, string | number>) => string, offer: DbCoupleOffer): string => {
  switch (offer.status) {
    case 'pending':
      return t('coupleOffers.statusPending');
    case 'accepted':
      return t('coupleOffers.statusAccepted');
    case 'declined':
      return t('coupleOffers.statusDeclined');
    case 'completed':
      return t('coupleOffers.statusCompleted');
    case 'failed':
      return t('coupleOffers.statusFailed');
    case 'cancel_pending':
      return t('coupleOffers.statusCancelPending');
    case 'cancelled':
      return t('coupleOffers.statusCancelled');
    default:
      return offer.status;
  }
};

const CATEGORY_KEYS: { id: string; key: TranslationKey; points: number }[] = [
  { id: 'door', key: 'addAction.categoryDoor', points: 1 },
  { id: 'compliment', key: 'addAction.categoryCompliment', points: 2 },
  { id: 'breakfast', key: 'addAction.categoryBreakfast', points: 5 },
  { id: 'help', key: 'addAction.categoryHelp', points: 5 },
  { id: 'clean', key: 'addAction.categoryClean', points: 7 },
  { id: 'laundry', key: 'addAction.categoryLaundry', points: 10 },
  { id: 'support', key: 'addAction.categorySupport', points: 10 },
  { id: 'fix', key: 'addAction.categoryFix', points: 15 },
  { id: 'surprise', key: 'addAction.categorySurprise', points: 20 },
];

export const AddActionScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useCoupleSync();
  const offers = useCoupleOffers();
  const { t } = useTranslation();
  const [tab, setTab] = useState<AddTab>('quick');
  const [direction, setDirection] = useState<Direction | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPoints, setCustomPoints] = useState('10');

  const [offerTitle, setOfferTitle] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [deadlinePreset, setDeadlinePreset] = useState(DEADLINE_PRESETS[1].key);
  const [counterDraftFor, setCounterDraftFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');

  const myId = auth.session?.user?.id;
  const offerPriceValue = parseInt(offerPrice, 10);
  const offerValid = offerTitle.trim().length > 0 && Number.isFinite(offerPriceValue) && offerPriceValue > 0 && !!sync.partner;

  const handleSendOffer = async () => {
    if (!offerValid) return;
    haptics.confirm();
    const preset = DEADLINE_PRESETS.find((p) => p.key === deadlinePreset) ?? DEADLINE_PRESETS[1];
    const ok = await offers.createOffer(offerTitle.trim(), offerPriceValue, preset.compute().toISOString());
    if (ok) {
      setOfferTitle('');
      setOfferPrice('');
    }
  };

  const handleComplete = async (offerId: string) => {
    haptics.success();
    await offers.completeAgreement(offerId);
  };

  const handleFailPenalty = async (offerId: string) => {
    haptics.select();
    await offers.failAgreementPenalty(offerId, FAILURE_PENALTY_MULTIPLIER);
  };

  const handleRequestCancel = async (offerId: string) => {
    haptics.select();
    await offers.requestCancelAgreement(offerId);
  };

  const handleRespondCancel = async (offerId: string, accept: boolean) => {
    haptics.select();
    await offers.respondCancelAgreement(offerId, accept);
  };

  const handleRespondOffer = async (offerId: string, accept: boolean) => {
    haptics.success();
    await offers.respondOffer(offerId, accept);
  };

  const openCounterDraft = (offerId: string, currentPrice: number) => {
    setCounterDraftFor(offerId);
    setCounterPrice(String(currentPrice));
  };

  const submitCounter = async (offerId: string) => {
    const value = parseInt(counterPrice, 10);
    if (!Number.isFinite(value) || value <= 0) return;
    haptics.confirm();
    const ok = await offers.proposeCounter(offerId, value);
    if (ok) {
      setCounterDraftFor(null);
      setCounterPrice('');
    }
  };

  const respondToCounter = async (counterId: string, accept: boolean) => {
    haptics.success();
    await offers.respondCounter(counterId, accept);
  };

  // "toPartner" (Я сделал(а) для него/неё) credits me -- I did the deed.
  // "fromPartner" (Он/она сделал(а) для меня) credits my partner.
  const recipientFor = (dir: Direction): string | undefined =>
    dir === 'toPartner' ? auth.session?.user?.id : sync.partner?.id;

  // Guards against a duplicate entry from a fast double-tap: navigate()
  // keeps this screen mounted and tappable through its transition animation,
  // so without this a second tap before the screen changes could add the
  // same action twice.
  const submittedRef = useRef(false);

  const handlePickCategory = async (title: string, points: number) => {
    if (!direction || submittedRef.current) return;
    submittedRef.current = true;
    haptics.confirm();
    const ok = await sync.addAction(title, points, recipientFor(direction));
    if (ok) {
      navigation.navigate('Home');
    } else {
      // Failed (e.g. network drop) -- let the user see the error and retry
      // instead of silently losing the action while the screen moves on.
      submittedRef.current = false;
    }
  };

  const handleCustomSubmit = async () => {
    if (!direction || !customTitle.trim() || submittedRef.current) return;
    submittedRef.current = true;
    haptics.confirm();
    const parsed = Math.abs(parseInt(customPoints, 10) || 0);
    const ok = await sync.addAction(customTitle.trim(), parsed, recipientFor(direction));
    if (ok) {
      navigation.navigate('Home');
    } else {
      submittedRef.current = false;
    }
  };

  return (
    <ScreenContainer inTabBar>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.text }]}>{t('addAction.title')}</Text>

        {!!sync.error && <BackendStatusBanner message={sync.error} onRetry={sync.clearError} />}
        {!!offers.error && <BackendStatusBanner message={offers.error} onRetry={offers.clearError} />}

        <FilterTabs
          options={[
            { key: 'quick', label: t('coupleOffers.tabQuick') },
            { key: 'offer', label: t('coupleOffers.tabOffer') },
          ]}
          value={tab}
          onChange={(key) => setTab(key as AddTab)}
        />

        {tab === 'offer' ? (
          <>
            <View style={[styles.form, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={offerTitle}
                onChangeText={setOfferTitle}
                placeholder={t('coupleOffers.namePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <TextInput
                value={offerPrice}
                onChangeText={(v) => setOfferPrice(v.replace(/[^0-9]/g, ''))}
                placeholder={t('coupleOffers.pricePlaceholder')}
                keyboardType="number-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
              <Text style={[styles.label, { color: colors.text }]}>{t('coupleOffers.deadlineLabel')}</Text>
              <View style={styles.deadlineRow}>
                {DEADLINE_PRESETS.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => setDeadlinePreset(p.key)}
                    style={[
                      styles.deadlineChip,
                      {
                        borderColor: deadlinePreset === p.key ? colors.primary : colors.border,
                        backgroundColor: deadlinePreset === p.key ? colors.background : colors.card,
                        borderWidth: deadlinePreset === p.key ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.deadlineChipText, { color: colors.text }]}>{t(p.labelKey)}</Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton label={t('coupleOffers.sendButton')} onPress={handleSendOffer} disabled={!offerValid} />
            </View>

            <Text style={[styles.label, { color: colors.text }]}>{t('coupleOffers.myOffersTitle')}</Text>
            {offers.offers.filter((o) => o.created_by === myId).length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('coupleOffers.emptyMine')}</Text>
            ) : (
              offers.offers
                .filter((o) => o.created_by === myId)
                .map((o) => {
                  const activeCounter = offers.counters.find((c) => c.offer_id === o.id && c.status === 'pending');
                  return (
                    <View key={o.id} style={[styles.offerCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.offerCardTitle, { color: colors.text }]}>{o.title}</Text>
                      <Text style={[styles.offerCardPrice, { color: colors.primary }]}>{o.price_points}</Text>
                      <Text style={[styles.offerCardStatus, { color: colors.textSecondary }]}>{statusLabel(t, o)}</Text>
                      {!!o.deadline && <Text style={[styles.offerCardDeadline, { color: colors.textSecondary }]}>{t('coupleOffers.deadlineIs', { date: new Date(o.deadline).toLocaleDateString() })}</Text>}
                      {activeCounter && (
                        <View style={[styles.offerBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.offerBoxLabel, { color: colors.text }]}>
                            {t('coupleOffers.counterOffer', { price: activeCounter.price_points })}
                          </Text>
                          <View style={styles.actionsRow}>
                            <PrimaryButton
                              label={t('coupleOffers.accept')}
                              onPress={() => respondToCounter(activeCounter.id, true)}
                              style={styles.actionButton}
                            />
                            <PrimaryButton
                              label={t('coupleOffers.decline')}
                              onPress={() => respondToCounter(activeCounter.id, false)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          </View>
                        </View>
                      )}
                      {o.status === 'accepted' && (
                        <View style={styles.actionsRow}>
                          {isOverdue(o) && (
                            <PrimaryButton
                              label={t('coupleOffers.applyPenalty', { multiplier: FAILURE_PENALTY_MULTIPLIER })}
                              onPress={() => handleFailPenalty(o.id)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          )}
                          <PrimaryButton
                            label={t('coupleOffers.cancelByConsent')}
                            onPress={() => handleRequestCancel(o.id)}
                            variant="outline"
                            style={styles.actionButton}
                          />
                        </View>
                      )}
                      {o.status === 'cancel_pending' &&
                        (o.cancel_requested_by === myId ? (
                          <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('coupleOffers.cancelWaiting')}</Text>
                        ) : (
                          <View style={styles.actionsRow}>
                            <PrimaryButton label={t('coupleOffers.accept')} onPress={() => handleRespondCancel(o.id, true)} style={styles.actionButton} />
                            <PrimaryButton
                              label={t('coupleOffers.decline')}
                              onPress={() => handleRespondCancel(o.id, false)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          </View>
                        ))}
                    </View>
                  );
                })
            )}

            <Text style={[styles.label, { color: colors.text }]}>{t('coupleOffers.partnerOffersTitle')}</Text>
            {offers.offers.filter((o) => o.created_by !== myId).length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('coupleOffers.emptyPartner')}</Text>
            ) : (
              offers.offers
                .filter((o) => o.created_by !== myId)
                .map((o) => {
                  const activeCounter = offers.counters.find((c) => c.offer_id === o.id && c.status === 'pending');
                  const isDrafting = counterDraftFor === o.id;
                  return (
                    <View key={o.id} style={[styles.offerCard, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.offerCardTitle, { color: colors.text }]}>{o.title}</Text>
                      <Text style={[styles.offerCardPrice, { color: colors.primary }]}>{o.price_points}</Text>
                      {!!o.deadline && <Text style={[styles.offerCardDeadline, { color: colors.textSecondary }]}>{t('coupleOffers.deadlineIs', { date: new Date(o.deadline).toLocaleDateString() })}</Text>}

                      {activeCounter ? (
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('coupleOffers.counterWaiting')}</Text>
                      ) : o.status === 'pending' ? (
                        <>
                          <View style={styles.actionsRow}>
                            <PrimaryButton label={t('coupleOffers.accept')} onPress={() => handleRespondOffer(o.id, true)} style={styles.actionButton} />
                            <PrimaryButton
                              label={t('coupleOffers.decline')}
                              onPress={() => handleRespondOffer(o.id, false)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          </View>
                          {!isDrafting ? (
                            <PrimaryButton
                              label={t('coupleOffers.proposeCounter')}
                              onPress={() => openCounterDraft(o.id, o.price_points)}
                              variant="outline"
                              style={styles.counterButton}
                            />
                          ) : (
                            <View style={styles.counterForm}>
                              <TextInput
                                value={counterPrice}
                                onChangeText={(v) => setCounterPrice(v.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                placeholderTextColor={colors.textSecondary}
                                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                              />
                              <View style={styles.actionsRow}>
                                <PrimaryButton label={t('coupleOffers.sendCounter')} onPress={() => submitCounter(o.id)} style={styles.actionButton} />
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
                      ) : o.status === 'accepted' ? (
                        <>
                          <View style={styles.actionsRow}>
                            <PrimaryButton label={t('coupleOffers.markCompleted')} onPress={() => handleComplete(o.id)} style={styles.actionButton} />
                            <PrimaryButton
                              label={t('coupleOffers.cancelByConsent')}
                              onPress={() => handleRequestCancel(o.id)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          </View>
                          {isOverdue(o) && (
                            <PrimaryButton
                              label={t('coupleOffers.applyPenalty', { multiplier: FAILURE_PENALTY_MULTIPLIER })}
                              onPress={() => handleFailPenalty(o.id)}
                              variant="outline"
                              style={styles.counterButton}
                            />
                          )}
                        </>
                      ) : o.status === 'cancel_pending' ? (
                        o.cancel_requested_by === myId ? (
                          <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('coupleOffers.cancelWaiting')}</Text>
                        ) : (
                          <View style={styles.actionsRow}>
                            <PrimaryButton label={t('coupleOffers.accept')} onPress={() => handleRespondCancel(o.id, true)} style={styles.actionButton} />
                            <PrimaryButton
                              label={t('coupleOffers.decline')}
                              onPress={() => handleRespondCancel(o.id, false)}
                              variant="outline"
                              style={styles.actionButton}
                            />
                          </View>
                        )
                      ) : (
                        <Text style={[styles.offerCardStatus, { color: colors.textSecondary }]}>{statusLabel(t, o)}</Text>
                      )}
                    </View>
                  );
                })
            )}
          </>
        ) : (
          <>
        <Text style={[styles.label, { color: colors.text }]}>{t('addAction.whoLabel')}</Text>
        <View style={styles.directionRow}>
          <Pressable
            onPress={() => setDirection('toPartner')}
            style={[
              styles.directionButton,
              {
                borderColor: direction === 'toPartner' ? colors.primary : colors.border,
                backgroundColor: direction === 'toPartner' ? colors.background : colors.card,
                borderWidth: direction === 'toPartner' ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.directionText, { color: colors.text }]}>{t('addAction.toPartner')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDirection('fromPartner')}
            style={[
              styles.directionButton,
              {
                borderColor: direction === 'fromPartner' ? colors.primary : colors.border,
                backgroundColor: direction === 'fromPartner' ? colors.background : colors.card,
                borderWidth: direction === 'fromPartner' ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.directionText, { color: colors.text }]}>{t('addAction.fromPartner')}</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>{t('addAction.actionLabel')}</Text>
        <View style={[styles.categoryList, !direction && styles.disabled]} pointerEvents={direction ? 'auto' : 'none'}>
          {CATEGORY_KEYS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => handlePickCategory(t(c.key), c.points)}
              style={[styles.chip, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.chipTitle, { color: colors.text }]}>{t(c.key)}</Text>
              <Text style={[styles.chipPoints, { color: colors.success }]}>+{c.points}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowCustom((v) => !v)}
            style={[
              styles.chip,
              shadow.soft,
              { backgroundColor: showCustom ? colors.background : colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.chipTitle, { color: colors.text }]}>{t('addAction.other')}</Text>
          </Pressable>
        </View>

        {showCustom && (
          <View style={styles.customBox}>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder={t('addAction.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            />
            <TextInput
              value={customPoints}
              onChangeText={(v) => setCustomPoints(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder={t('addAction.pointsPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            />
            <PrimaryButton
              label={t('addAction.addButton')}
              onPress={handleCustomSubmit}
              disabled={!direction || !customTitle.trim()}
            />
          </View>
        )}

        {!direction && <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('addAction.hint')}</Text>}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  directionRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  directionButton: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  directionText: {
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  categoryList: {
    marginBottom: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chipTitle: {
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  chipPoints: {
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  customBox: {
    marginTop: spacing.sm,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  form: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  offerCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  offerCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  offerCardPrice: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: 2,
  },
  offerCardStatus: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  offerCardDeadline: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  deadlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  deadlineChip: {
    borderRadius: radius.round,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  deadlineChipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  offerBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  offerBoxLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
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
});
