import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { useChat } from '../../store/ChatContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { DbChatMessage } from '../../types/database';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Chat'>,
  NativeStackScreenProps<RootStackParamList>
>;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const ChatScreen = (_props: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const chat = useChat();
  const sync = useCoupleSync();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<DbChatMessage>>(null);
  const canSend = text.trim().length > 0;

  // Kept out of the dependency array on purpose -- `chat.markRead` is a new
  // function identity every time `messages` changes (it's rebuilt inside the
  // Context's useMemo), so depending on it directly would refire this effect
  // every time it marks something read, which changes messages, which...
  // an infinite loop. `messages.length` is a stable primitive: this fires
  // once on mount and again only when the count actually changes (a new
  // message arrives via realtime while the screen is open).
  const markReadRef = useRef(chat.markRead);
  markReadRef.current = chat.markRead;
  useEffect(() => {
    markReadRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages.length]);

  const handleSend = () => {
    if (!canSend) return;
    const toSend = text;
    setText('');
    chat.sendMessage(toSend);
  };

  const renderItem = ({ item }: { item: DbChatMessage }) => {
    const mine = item.sender_id === chat.myUserId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: radius.sm },
          ]}
        >
          <Text style={[styles.bubbleText, { color: mine ? colors.textOnPrimary : colors.text }]}>{item.text}</Text>
          <Text style={[styles.bubbleTime, { color: mine ? colors.textOnPrimary : colors.textSecondary, opacity: 0.75 }]}>
            {formatTime(item.created_at)}
            {mine ? `  ${item.read_at ? t('chat.read') : t('chat.sent')}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenBackground>
    <ScreenContainer transparent style={styles.container}>
      <ScreenHeader title={sync.partner?.name ?? t('chat.title')} />

      {!!chat.error && <BackendStatusBanner message={chat.error} onRetry={chat.clearError} />}

      {chat.loading && chat.messages.length === 0 ? (
        <LoadingState lines={4} />
      ) : chat.messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="message" title={t('chat.emptyTitle')} description={t('chat.emptyDescription')} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={chat.messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View
        style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendButton, { backgroundColor: canSend ? colors.primary : colors.border }]}
        >
          <Text style={[styles.sendButtonText, { color: colors.textOnPrimary }]}>{t('chat.send')}</Text>
        </Pressable>
      </View>
    </ScreenContainer></ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    // The real bottom safe-area/nav-bar inset is applied to the composer
    // itself (inputRow, below) instead of here -- ScreenContainer's own
    // default (insets.bottom + a large fixed 38px) is tuned for a screen
    // that ends in a single button, not a chat composer that must also
    // track the keyboard precisely.
    paddingBottom: 0,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
    flexWrap: 'wrap',
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendButton: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
