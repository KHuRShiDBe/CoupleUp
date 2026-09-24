import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { PREMIUM_THEMES } from '../../theme/premiumThemes';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { PurchaseModal } from '../../components/common/PurchaseModal';
import { useAppStore } from '../../store/AppContext';
import { InvalidParamsState } from '../../components/common/InvalidParamsState';
import { useTranslation } from '../../localization/useTranslation';
import { PremiumThemeId } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ThemePreview'>;

const NAV_ICONS = ['Home', 'История', 'Добавить', 'Награды', 'Профиль'];

const isPremiumThemeId = (value: unknown): value is PremiumThemeId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PREMIUM_THEMES, value);

export const ThemePreviewScreen = (props: Props) => {
  const { t } = useTranslation();
  const themeId: unknown = props.route.params?.themeId;
  if (!isPremiumThemeId(themeId)) return <InvalidParamsState message={t('recovery.invalidTheme')} />;
  return <ThemePreviewContent {...props} themeId={themeId} />;
};

const ThemePreviewContent = ({ navigation, themeId }: Props & { themeId: PremiumThemeId }) => {
  const { colors: appColors } = useTheme();
  const { ownedThemes, selectedPremiumTheme, actions } = useAppStore();
  const meta = PREMIUM_THEMES[themeId];
  const preview = meta.colors;
  const owned = ownedThemes.includes(meta.id);
  const isApplied = selectedPremiumTheme === meta.id;
  const [showPurchase, setShowPurchase] = useState(false);

  const handleApply = () => actions.selectPremiumTheme(meta.id);

  const handlePurchaseConfirm = () => {
    actions.purchasePremiumTheme(meta.id);
    actions.selectPremiumTheme(meta.id);
    setShowPurchase(false);
  };

  return (
    <ScreenContainer>
      <ScreenHeader title={`Тема ${meta.title}`} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.hint, { color: appColors.textSecondary }]}>
          Предпросмотр — тема ещё не применена, пока вы её не выберете
        </Text>

        <View style={[styles.previewFrame, { backgroundColor: preview.background, borderColor: preview.border }]}>
          <View style={[styles.previewCard, { backgroundColor: preview.card, borderColor: preview.border }]}>
            <Text style={[styles.previewCardTitle, { color: preview.text }]}>Карточка</Text>
            <Text style={[styles.previewCardText, { color: preview.textSecondary }]}>Так выглядит текст и фон</Text>
          </View>

          <View style={[styles.previewPointsCard, { backgroundColor: preview.primary }]}>
            <Text style={[styles.previewPointsValue, { color: preview.textOnPrimary }]}>1250</Text>
            <Text style={[styles.previewPointsLabel, { color: preview.textOnPrimary }]}>Твои баллы</Text>
          </View>

          <View style={styles.previewRow}>
            <View style={[styles.previewAvatar, { backgroundColor: preview.card, borderColor: preview.primary }]} />
            <View style={[styles.previewButton, { backgroundColor: preview.primary }]}>
              <Text style={[styles.previewButtonText, { color: preview.textOnPrimary }]}>Продолжить</Text>
            </View>
          </View>

          <View style={[styles.previewNav, { backgroundColor: preview.card, borderColor: preview.border }]}>
            {NAV_ICONS.map((label, index) => (
              <View key={label} style={styles.previewNavItem}>
                <View
                  style={[
                    styles.previewNavDot,
                    { backgroundColor: index === 0 ? preview.primary : preview.border },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.priceLabel, { color: appColors.textSecondary }]}>Цена</Text>
        <Text style={[styles.price, { color: appColors.text }]}>{owned ? 'Уже куплено' : meta.price}</Text>

        {owned ? (
          <PrimaryButton
            label={isApplied ? 'Тема применена' : 'Выбрать эту тему'}
            onPress={handleApply}
            disabled={isApplied}
          />
        ) : (
          <PrimaryButton label={`Купить за ${meta.price}`} onPress={() => setShowPurchase(true)} />
        )}
      </ScrollView>

      <PurchaseModal
        visible={showPurchase}
        title={`Тема ${meta.title}`}
        price={meta.price}
        description="Косметическая тема оформления. Не влияет на баллы, задания и другие функции приложения."
        onConfirm={handlePurchaseConfirm}
        onCancel={() => setShowPurchase(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  previewFrame: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewCardText: {
    fontSize: fontSize.xs,
  },
  previewPointsCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewPointsValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  previewPointsLabel: {
    fontSize: fontSize.xs,
    opacity: 0.9,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  previewButton: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  previewNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
  },
  previewNavItem: {
    alignItems: 'center',
  },
  previewNavDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priceLabel: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  price: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
