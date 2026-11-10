import { useCallback, useMemo, useState } from 'react';

function readHidden(key: string) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useAdminHiddenRecords(section: string) {
  const key = `growmoney-admin-hidden-records:${section}`;
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => readHidden(key));
  const [showHidden, setShowHidden] = useState(false);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const toggleHidden = useCallback((id: string) => {
    setHiddenIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  const isHidden = useCallback((id: string) => hiddenSet.has(id), [hiddenSet]);
  return { hiddenIds: hiddenSet, hiddenCount: hiddenIds.length, showHidden, setShowHidden, toggleHidden, isHidden };
}
