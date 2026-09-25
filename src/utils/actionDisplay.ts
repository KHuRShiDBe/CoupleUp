import { DbAction, DbUser } from '../types/database';
import { ActionHistoryItem, Role } from '../types';

interface ActionDisplayContext {
  myId: string;
  myRole: Role;
  myAvatar: number | null;
  myName: string;
  partner: DbUser | null;
  partnerFallbackName: string;
}

const formatActionDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
};

// Maps a real Supabase action row to the shared ActionHistoryItem shape
// ActionListItem already renders. `authorRole`/`avatarId` describe the
// RECIPIENT (whose balance the points apply to, matching the existing
// "isMine = item.authorRole === role" convention) -- `arrowLabel` adds the
// "who did it for whom" line whenever the logger and the recipient differ.
export const toActionHistoryItem = (action: DbAction, ctx: ActionDisplayContext): ActionHistoryItem => {
  const recipientIsMe = action.recipient_id === ctx.myId;
  const authorIsMe = action.author_id === ctx.myId;
  // Read the partner's REAL role -- role isn't unique per couple (both
  // partners could pick "male"), so assuming "whatever I'm not" used to show
  // the wrong avatar/color for the partner's own entries when roles collided.
  const partnerRole: Role = ctx.partner?.role ?? (ctx.myRole === 'male' ? 'female' : 'male');
  const partnerName = ctx.partner?.name ?? ctx.partnerFallbackName;

  const recipientRole: Role = recipientIsMe ? ctx.myRole : partnerRole;
  const recipientAvatar = recipientIsMe ? ctx.myAvatar : (ctx.partner?.selected_avatar ?? null);
  const authorName = authorIsMe ? ctx.myName : partnerName;
  const recipientName = recipientIsMe ? ctx.myName : partnerName;

  return {
    id: action.id,
    title: action.title,
    points: action.points,
    date: formatActionDate(action.created_at),
    authorRole: recipientRole,
    avatarId: recipientAvatar,
    arrowLabel: action.author_id !== action.recipient_id ? `${authorName} → ${recipientName}` : undefined,
  };
};
