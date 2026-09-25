// Shared seeded-randomness helpers so every "same content on both phones,
// no network round-trip" feature (daily actions, quests, TruthOrDare
// prompts, ...) uses one well-tested implementation.

// DJB2-style string hash -- stable, well-mixed, not cryptographic, doesn't need to be.
export const hashString = (input: string): number => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
};

// Tiny seeded PRNG (mulberry32) -- the same seed always produces the same
// sequence, which is what makes deterministic picks agree across devices.
export const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Deterministic pick of `count` items from `pool`, seeded by `seed` (e.g.
// `${coupleId}:${period}:${periodKey}`). Partial Fisher-Yates using the
// seeded PRNG, sliced and stable-sorted by `id` so the on-screen order
// doesn't jitter between re-renders.
export const pickDeterministic = <T extends { id: string }>(seed: string, pool: T[], count: number): T[] => {
  const rand = mulberry32(hashString(seed));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length)).sort((a, b) => a.id.localeCompare(b.id));
};
