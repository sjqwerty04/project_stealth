import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { emptySnapshot, hasMeaningfulContext } from './buildRecommendContext';
import { generateSnapshot } from './generateSnapshot';
import { parseSnapshot, tasteDoc } from './getTaste';
import type { TasteSnapshot } from './types';

const backfill = new Set<string>();

export function useTaste(): { snapshot: TasteSnapshot; loading: boolean } {
  const { user } = useAuth();
  const [remote, setSnapshot] = useState<TasteSnapshot>(emptySnapshot());

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      tasteDoc(user.uid),
      (snap) => {
        const parsed = snap.exists() ? parseSnapshot(snap.data()) : emptySnapshot();
        if (!backfill.has(user.uid) && !hasMeaningfulContext(parsed.context)) {
          backfill.add(user.uid);
          void generateSnapshot(user.uid);
        }
        setSnapshot(parsed);
      },
      () => {
        setSnapshot(emptySnapshot());
      }
    );
  }, [user]);

  if (!user) return { snapshot: emptySnapshot(), loading: false };
  return { snapshot: remote, loading: false };
}
