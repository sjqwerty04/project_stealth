import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { emptySnapshot } from './buildRecommendContext';
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
        if (!snap.exists()) {
          if (!backfill.has(user.uid)) {
            backfill.add(user.uid);
            void generateSnapshot(user.uid).finally(() => backfill.delete(user.uid));
          }
          setSnapshot(emptySnapshot());
          return;
        }
        setSnapshot(parseSnapshot(snap.data()));
      },
      () => {
        setSnapshot(emptySnapshot());
      }
    );
  }, [user]);

  if (!user) return { snapshot: emptySnapshot(), loading: false };
  return { snapshot: remote, loading: false };
}
