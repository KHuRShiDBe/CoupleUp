import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCoupleSync } from './CoupleSyncContext';
import * as chatService from '../services/supabase/chatService';
import { subscribeToChat } from '../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../services/supabase/errors';
import { DbChatMessage } from '../types/database';

interface ChatValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  messages: DbChatMessage[];
  // Partner's messages I haven't read yet -- never counts my own. Drives the
  // unread badge on the bottom tab bar's Chat icon.
  unreadCount: number;
  myUserId: string | null;
  sendMessage: (text: string) => Promise<void>;
  markRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ChatContext = createContext<ChatValue | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const sync = useCoupleSync();
  const userId = session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DbChatMessage[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !coupleId || !userId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await chatService.listMessages(coupleId);
      setMessages(rows);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    } finally {
      setLoading(false);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToChat(coupleId, refresh);
  }, [coupleId, refresh]);

  const value = useMemo<ChatValue>(
    () => ({
      loading,
      error,
      clearError: () => setError(null),
      messages,
      unreadCount: messages.filter((m) => m.sender_id !== userId && !m.read_at).length,
      myUserId: userId,
      sendMessage: async (text: string) => {
        if (!coupleId || !userId) return;
        setError(null);
        try {
          await chatService.sendMessage(coupleId, userId, text);
          await refresh();
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      markRead: async () => {
        if (!coupleId || !userId) return;
        try {
          await chatService.markPartnerMessagesRead(coupleId, userId);
          await refresh();
        } catch (e) {
          setError(friendlyMessage(toServiceError(e)));
        }
      },
      refresh,
    }),
    [loading, error, messages, userId, coupleId, refresh],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatValue => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
