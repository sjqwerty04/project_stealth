import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../../hooks/useAuth';
import { parseTheaterDoc, type KeptTheater } from './archive';

export type TheatersState = {
  theaters: KeptTheater[];
  loading: boolean;
  error: string | null;
};

type Snapshot = { uid: string; theaters: KeptTheater[]; error: string | null };

const SIGNED_OUT: TheatersState = { theaters: [], loading: false, error: null };
const PENDING: TheatersState = { theaters: [], loading: true, error: null };

export function useTheaters(): TheatersState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, 'users', uid, 'theaters'), orderBy('keptAt', 'desc')),
      (snap) => {
        const theaters = snap.docs
          .map((entry) => parseTheaterDoc(entry.id, entry.data()))
          .filter((theater): theater is KeptTheater => theater !== null);
        setSnapshot({ uid, theaters, error: null });
      },
      (err) => {
        console.error('Theater archive snapshot failed:', err);
        setSnapshot({ uid, theaters: [], error: err.message });
      },
    );
  }, [uid]);

  if (!uid) return SIGNED_OUT;
  if (snapshot?.uid !== uid) return PENDING;
  return { theaters: snapshot.theaters, loading: false, error: snapshot.error };
}
