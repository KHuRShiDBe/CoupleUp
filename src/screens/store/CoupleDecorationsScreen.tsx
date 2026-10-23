import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { DECORATION_IDS, DECORATIONS } from '../../constants/decorations';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PurchaseModal } from '../../components/common/PurchaseModal';
import { useAppStore } from '../../store/AppContext';
import { DecorationId } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleDecorations'>;

export const CoupleDecorationsScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { ownedDecorations, selectedDecoration, actions } = useAppStore();
  const [purchaseTarget, setPurchaseTarget] = useState<DecorationId | null>(null);

  const isOwned = (id: DecorationId) => DECORATIONS[id].price === null || ownedDecorations.includes(id);

  const handlePress = (id: DecorationId) => {
    if (isOwned(id)) {
      actions.selectDecoration(id);
      return;
    }
    setPurchaseTarget(id);
  };

  const handlePurchaseConfirm = () => {
    if (!purchaseTarget) return;
    actions.purchaseDecoration(purchaseTarget);
    actions.selectDecoration(purchaseTarget);
    setPurchaseTarget(null);
  };

  const targetMeta = purchaseTarget ? DECORATIONS[purchaseTarget] : null;

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Оформление пары" onBack={() => navigation.goBack()} />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Рамка аватара, фон карточки пары и небольшой бейдж на Couple Profile
        </Text>

        {DECORATION_IDS.map((id) => {
          const deco = DECORATIONS[id];
          const owned = isOwned(id);
          const isSelected = selectedDecoration === id;
          const ringColor = deco.avatarRingColor ?? colors.primary;
          const cardBorderColor = deco.cardBorderColor ?? colors.primary;

          return (
            <Pressable
              key={id}
              onPress={() => handlePress(id)}
              style={[
                styles.card,
                shadow.soft,
                { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
              ]}
            >
              <View
                style={[
                  styles.previewRing,
                  {
                    borderColor: ringColor,
                    borderWidth: deco.avatarRingWidth,
                    borderStyle: deco.avatarRingStyle,
                  },
                ]}
              >
                <View style={[styles.previewDot, { backgroundColor: colors.background }]} />
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{deco.title}</Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{deco.description}</Text>
                {deco.badgeLabel && (
                  <View style={[styles.badge, { borderColor: cardBorderColor }]}>
                    <Text style={[styles.badgeText, { color: cardBorderColor }]}>{deco.badgeLabel}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statusWrap}>
                {isSelected ? (
                  <Text style={[styles.statusText, { color: colors.success }]}>Применено</Text>
                ) : (
                  <Text style={[styles.statusText, { color: owned ? colors.primary : colors.textSecondary }]}>
                    {owned ? 'Выбрать' : deco.price}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <PurchaseModal
        visible={!!purchaseTarget}
        title={targetMeta?.title ?? ''}
        price={targetMeta?.price ?? ''}
        description={targetMeta?.description ?? ''}
        onConfirm={handlePurchaseConfirm}
        onCancel={() => setPurchaseTarget(null)}
      />
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previewRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cardBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  statusWrap: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
