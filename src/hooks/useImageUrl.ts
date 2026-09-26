import { useEffect, useState } from 'react';
import { backend } from '@/services/backend';

/** Resolves a storage path to a (signed) URL. */
export function useImageUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    backend
      .imageUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [path]);
  return { url, error };
}
