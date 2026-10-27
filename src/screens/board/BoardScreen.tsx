import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { fontSize, radius, shadow, spacing } from '../../theme/layout';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { BackendStatusBanner } from '../../components/common/BackendStatusBanner';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useAuth } from '../../store/AuthContext';
import { useCoupleSync } from '../../store/CoupleSyncContext';
import { useTranslation } from '../../localization/useTranslation';
import { addBoardItem, clearBoard, deleteBoardItem, listBoardItems } from '../../services/supabase/boardService';
import { subscribeToBoard } from '../../services/supabase/realtime';
import { friendlyMessage, toServiceError } from '../../services/supabase/errors';
import { BoardColor, BoardStrokeData, BoardTextData, DbBoardItem } from '../../types/database';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Board'>;
type Tool = 'pen' | 'eraser' | 'text';

const BOARD_BG = '#FFFFFF';
const COLORS: Record<BoardColor, string> = { red: '#E53935', blue: '#1E88E5', green: '#43A047' };
const PEN_WIDTH = 4;
const ERASER_WIDTH = 24;
const MAX_POINTS = 400;
const MIN_STEP_PX = 2;

const toPath = (pts: [number, number][]): string =>
  pts.length === 0 ? '' : `M ${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map(([x, y]) => ` L ${x} ${y}`).join('');

// Shared couple board (migration 0050): finger drawing, text, 3 colours,
// eraser, undo (own last action), clear with confirmation. Every finished
// action is saved immediately and synced to the partner via Realtime.
export const BoardScreen = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useCoupleSync();
  const myId = auth.session?.user?.id ?? null;
  const coupleId = sync.couple?.id ?? null;

  const [items, setItems] = useState<DbBoardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<BoardColor>('blue');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<[number, number][]>([]);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Optimistic items not yet confirmed by the server (temp ids).
  const pending = useRef<Map<string, DbBoardItem>>(new Map());
  const liveRef = useRef<[number, number][]>([]);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;

  const refresh = useCallback(async () => {
    if (!coupleId) return;
    try {
      const rows = await listBoardItems(coupleId);
      setItems([...rows, ...pending.current.values()]);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    }
  }, [coupleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeToBoard(coupleId, refresh);
  }, [coupleId, refresh]);

  const save = useCallback(
    async (kind: DbBoardItem['kind'], itemColor: DbBoardItem['color'], data: BoardStrokeData | BoardTextData) => {
      if (!coupleId || !myId) return;
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const temp: DbBoardItem = {
        id: tempId,
        couple_id: coupleId,
        author_id: myId,
        kind,
        color: itemColor,
        data,
        created_at: new Date().toISOString(),
      };
      pending.current.set(tempId, temp);
      setItems((prev) => [...prev, temp]);
      try {
        const row = await addBoardItem({ couple_id: coupleId, author_id: myId, kind, color: itemColor, data });
        pending.current.delete(tempId);
        setItems((prev) => {
          const without = prev.filter((i) => i.id !== tempId && i.id !== row.id);
          return [...without, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      } catch (e) {
        pending.current.delete(tempId);
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setError(friendlyMessage(toServiceError(e)));
      }
    },
    [coupleId, myId],
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX: x, locationY: y } = evt.nativeEvent;
          if (toolRef.current === 'text') return;
          liveRef.current = [[x, y]];
          setLive(liveRef.current);
        },
        onPanResponderMove: (evt) => {
          if (toolRef.current === 'text') return;
          const { locationX: x, locationY: y } = evt.nativeEvent;
          const pts = liveRef.current;
          const last = pts[pts.length - 1];
          if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP_PX) return;
          if (pts.length >= MAX_POINTS) return;
          liveRef.current = [...pts, [x, y]];
          setLive(liveRef.current);
        },
        onPanResponderRelease: (evt) => {
          const { w, h } = sizeRef.current;
          if (!w || !h) return;
          if (toolRef.current === 'text') {
            const { locationX: x, locationY: y } = evt.nativeEvent;
            setTextValue('');
            setTextAt({ x: x / w, y: y / h });
            return;
          }
          const pts = liveRef.current;
          liveRef.current = [];
          setLive([]);
          if (pts.length === 0) return;
          const norm = pts.map(([x, y]) => [+(x / w).toFixed(4), +(y / h).toFixed(4)] as [number, number]);
          const isEraser = toolRef.current === 'eraser';
          saveRef.current(isEraser ? 'eraser' : 'stroke', isEraser ? 'eraser' : colorRef.current, { points: norm });
        },
      }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const handleUndo = async () => {
    const mine = [...items].reverse().find((i) => i.author_id === myId && !i.id.startsWith('temp-'));
    if (!mine) return;
    haptics.select();
    setItems((prev) => prev.filter((i) => i.id !== mine.id));
    try {
      await deleteBoardItem(mine.id);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
      refresh();
    }
  };

  const handleClear = async () => {
    setConfirmClear(false);
    if (!coupleId) return;
    haptics.confirm();
    pending.current.clear();
    setItems([]);
    try {
      await clearBoard(coupleId);
    } catch (e) {
      setError(friendlyMessage(toServiceError(e)));
    }
    refresh();
  };

  const handleAddText = () => {
    const text = textValue.trim();
    const at = textAt;
    setTextAt(null);
    if (!text || !at) return;
    save('text', color, { x: at.x, y: at.y, text: text.slice(0, 200) });
  };

  const strokeColor = (c: DbBoardItem['color']) => (c === 'eraser' ? BOARD_BG : COLORS[c]);

  if (!coupleId) {
    return (
      <ScreenBackground>
        <ScreenContainer transparent>
          <ScreenHeader title={t('board.title')} onBack={() => navigation.goBack()} />
          <BackendStatusBanner message={t('compliments.noPartner')} />
        </ScreenContainer>
      </ScreenBackground>
    );
  }

  const ToolButton = ({ id, label }: { id: Tool; label: string }) => (
    <Pressable
      onPress={() => setTool(id)}
      style={[
        styles.toolButton,
        { borderColor: tool === id ? colors.primary : colors.border, backgroundColor: colors.card },
      ]}
    >
      <Text style={[styles.toolText, { color: tool === id ? colors.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScreenBackground>
      <ScreenContainer transparent>
        <ScreenHeader title={t('board.title')} onBack={() => navigation.goBack()} />
        {!!error && <BackendStatusBanner message={error} onRetry={() => setError(null)} />}

        <View style={styles.toolbar}>
          {(Object.keys(COLORS) as BoardColor[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setColor(c);
                if (tool === 'eraser') setTool('pen');
              }}
              style={[
                styles.colorDot,
                { backgroundColor: COLORS[c], borderColor: color === c && tool !== 'eraser' ? colors.text : 'transparent' },
              ]}
            />
          ))}
          <ToolButton id="pen" label="✏️" />
          <ToolButton id="text" label="T" />
          <ToolButton id="eraser" label="🧽" />
          <Pressable onPress={handleUndo} style={[styles.toolButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.toolText, { color: colors.text }]}>↶</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmClear(true)} style={[styles.toolButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.toolText, { color: colors.danger }]}>🗑</Text>
          </Pressable>
        </View>

        <View style={[styles.board, shadow.soft, { borderColor: colors.border }]} onLayout={onLayout} {...pan.panHandlers}>
          <Svg width={size.w} height={size.h} pointerEvents="none">
            {items.map((it) => {
              if (it.kind === 'text') {
                const d = it.data as BoardTextData;
                return (
                  <SvgText key={it.id} x={d.x * size.w} y={d.y * size.h} fill={strokeColor(it.color)} fontSize={18} fontWeight="700">
                    {d.text}
                  </SvgText>
                );
              }
              const pts = (it.data as BoardStrokeData).points.map(([x, y]) => [x * size.w, y * size.h] as [number, number]);
              return (
                <Path
                  key={it.id}
                  d={toPath(pts)}
                  stroke={strokeColor(it.color)}
                  strokeWidth={it.kind === 'eraser' ? ERASER_WIDTH : PEN_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            })}
            {live.length > 0 && (
              <Path
                d={toPath(live)}
                stroke={tool === 'eraser' ? BOARD_BG : COLORS[color]}
                strokeWidth={tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
          {items.length === 0 && live.length === 0 && (
            <Text style={[styles.hint, { color: colors.textSecondary }]} pointerEvents="none">
              {t('board.hint')}
            </Text>
          )}
        </View>

        <ConfirmationModal
          visible={confirmClear}
          title={t('board.clearTitle')}
          message={t('board.clearMessage')}
          confirmLabel={t('board.clearConfirm')}
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />

        <Modal visible={!!textAt} transparent animationType="fade" onRequestClose={() => setTextAt(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                placeholder={t('board.textPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                autoFocus
                maxLength={200}
                style={[styles.input, { borderColor: colors.border, color: COLORS[color] }]}
              />
              <PrimaryButton label={t('board.addText')} onPress={handleAddText} disabled={!textValue.trim()} />
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
  },
  toolButton: {
    minWidth: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  toolText: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  board: {
    flex: 1,
    backgroundColor: BOARD_BG,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    fontSize: fontSize.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
});
