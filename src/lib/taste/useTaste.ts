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
  const [loading, setLoading] = useState<boolean>(Boolean(user?.uid));

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setLoading(false);
      setSnapshot(emptySnapshot());
      return;
    }
    setLoading(true);
    return onSnapshot(
      tasteDoc(uid),
      (snap) => {
        const parsed = snap.exists() ? parseSnapshot(snap.data()) : emptySnapshot();
        if (!backfill.has(uid) && !hasMeaningfulContext(parsed.context)) {
          backfill.add(uid);
          void generateSnapshot(uid).catch((err) => {
            console.warn('taste snapshot backfill failed:', err);
          });
        }
        setSnapshot(parsed);
        setLoading(false);
      },
      (err) => {
        console.warn('taste subscription error:', err);
        setSnapshot(emptySnapshot());
        setLoading(false);
      }
    );
  }, [user?.uid]);

  if (!user) return { snapshot: emptySnapshot(), loading: false };
  return { snapshot: remote, loading };
}
