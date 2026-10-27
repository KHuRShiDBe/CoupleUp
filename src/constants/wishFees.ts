// Wish economy (migration 0049). A wish's own price is never multiplied;
// options are separate one-time fees charged by the server:
//   deadline 1 h -> 50 points (0.5 BOND), 24 h -> 20 points (0.2 BOND),
//   no deadline -> free; "make important" -> 0.5 BOND.
export const WISH_DEADLINE_FEE_POINTS: Record<1 | 24, number> = { 1: 50, 24: 20 };

export const wishDeadlineFeePoints = (hours: 1 | 24 | null): number =>
  hours == null ? 0 : WISH_DEADLINE_FEE_POINTS[hours];

export const WISH_IMPORTANT_FEE_BOND = 0.5;
