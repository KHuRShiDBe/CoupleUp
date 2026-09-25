import { useEffect, useState } from 'react';

// Brief mock loading state for screens that render purely local/synchronous
// data today but should already feel like they're fetching something -- one
// timer per mount, so it only shows once per screen per app session.
export const useMockLoading = (durationMs = 450): boolean => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return loading;
};
