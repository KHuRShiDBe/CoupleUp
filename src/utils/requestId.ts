// A fresh v4-ish UUID per call -- used as an idempotency key for RPCs that
// spend real balance (e.g. spin_wish_roulette), so a transport-level retry
// of the exact same request can never be double-processed server-side. Not
// used for anything security-sensitive, so Math.random() is fine here --
// same pragmatic approach as utils/deviceId.ts.
export const generateRequestId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
