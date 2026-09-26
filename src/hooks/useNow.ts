import { useEffect, useState } from 'react';

/** Current time, updated every `ms` (paused while the tab is hidden). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(new Date());
    }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
