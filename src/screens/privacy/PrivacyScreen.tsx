import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacy'>;

interface Section {
  title: string;
  body: string;
}

// Informational only, and deliberately honest about what's real today rather
// than promising more than the app (in "code-ready, connect later" mode)
// actually does -- see supabase/README.md for what's cloud-backed vs local.
const SECTIONS: Section[] = [
  {
    title: 'Данные аккаунта',
    body: 'Если вы подключили облачный аккаунт: email, имя, выбранная роль и аватар, язык интерфейса. Хранится в Supabase, доступно только вам и, частично (имя, аватар, роль), вашему партнёру по паре.',
  },
  {
    title: 'Данные пары',
    body: 'Код приглашения, состав пары, общие баллы и их история — видны только двум участникам пары. Доступ жёстко ограничен на уровне базы данных (Row Level Security): ни один другой пользователь не может прочитать или изменить эти данные.',
  },
  {
    title: 'История действий',
    body: 'Список добрых дел, заданий, наград и штрафов хранится как единый журнал (ledger) внутри пары. Если один из партнёров удаляет аккаунт, история сохраняется у оставшегося партнёра — это осознанное решение, а не побочный эффект.',
  },
  {
    title: 'Уведомления',
    body: 'Токен push-уведомлений привязан к устройству и аккаунту. Отправляемые уведомления содержат только тип события и общий текст — без личных подробностей действия или сообщения.',
  },
  {
    title: 'Локальные данные',
    body: 'Онбординг, тема оформления, локальная история и настройки (пока не подключён облачный аккаунт) хранятся только на этом устройстве, в защищённом хранилище приложения. Ничего из этого не передаётся на сервер, пока вы сами не подключите синхронизацию.',
  },
  {
    title: 'Удаление аккаунта',
    body: 'Удаление аккаунта необратимо удаляет вход и профиль. Общая история пары сохраняется у партнёра (анонимизированной со стороны удалённого аккаунта). Реализовано через отдельную серверную функцию — приложение никогда не хранит привилегированный ключ для прямого удаления.',
  },
  {
    title: 'Контакты поддержки',
    body: 'Публичные ссылки на политику конфиденциальности, условия использования и страницу поддержки появятся здесь перед публикацией в сторах (см. Настройки → О приложении).',
  },
];

export const PrivacyScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();

  return (
    <ScreenContainer>
      <ScreenHeader title="Конфиденциальность" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Ниже — какие данные CoupleUp хранит и как они используются, простыми словами. Это не юридический документ.
        </Text>
        {SECTIONS.map((section) => (
          <View key={section.title} style={[styles.card, shadow.soft, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  intro: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
