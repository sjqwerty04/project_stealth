import { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { callLlmForJSON } from '../lib/llm';
import { loadSkill } from '../lib/skills';
import { hasMeaningfulContext, recordTasteEvent, SNAPSHOT_FRESH_MS, useTaste } from '../lib/taste';

type InsightsStats = {
  watchedCount: number;
  watchlistCount: number;
  likedPercent: number;
};

type AIInsightsResult = {
  personaLine: string;
  insights: string[];
};

export type UserInsights = {
  stats: InsightsStats | null;
  tasteProfile: any | null;
  personaLine: string | null;
  insightCards: string[];
  isLoading: boolean;
};

export function useUserInsights(): UserInsights {
  const { user } = useAuth();
  const { snapshot } = useTaste();
  const [stats, setStats] = useState<InsightsStats | null>(null);
  const [tasteProfile, setTasteProfile] = useState<any | null>(null);
  const [personaLine, setPersonaLine] = useState<string | null>(null);
  const [insightCards, setInsightCards] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (snapshot.identity.personaLine) {
      setPersonaLine(snapshot.identity.personaLine);
    }
    if (snapshot.generated.insightCards.length) {
      setInsightCards(snapshot.generated.insightCards);
    }
  }, [snapshot.identity.personaLine, snapshot.generated.insightCards]);

  useEffect(() => {
    if (!user?.uid) {
      setStats(null);
      setTasteProfile(null);
      setPersonaLine(null);
      setInsightCards([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const [filmsSnap, watchlistSnap, tasteProfileDoc] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'films')),
          getDocs(collection(db, 'users', user.uid, 'watchlist')),
          getDoc(doc(db, 'users', user.uid, 'profile_data', 'taste_profile')),
        ]);

        if (cancelled) return;

        const watchedDocs = filmsSnap.docs.map((d) => d.data()).filter((d) => d.watched === true);
        const watchedCount = watchedDocs.length;
        const watchlistCount = watchlistSnap.size;
        const likedCount = watchedDocs.filter((d) => d.verdict === 'liked').length;
        const likedPercent = watchedCount > 0 ? Math.round((likedCount / watchedCount) * 100) : 0;
        const rawTasteProfile = tasteProfileDoc.exists() ? tasteProfileDoc.data() : null;

        setStats({ watchedCount, watchlistCount, likedPercent });
        setTasteProfile(rawTasteProfile);

        const storedLine = snapshot.identity.personaLine || rawTasteProfile?.aiPersonaLine || null;
        const storedCards = snapshot.generated.insightCards;
        const fresh =
          snapshot.generated.updatedAt != null &&
          Date.now() - snapshot.generated.updatedAt < SNAPSHOT_FRESH_MS;

        if (storedLine) setPersonaLine(storedLine);
        if (storedCards.length) setInsightCards(storedCards);

        const shouldGenerateAI =
          !fresh &&
          !storedLine &&
          hasMeaningfulContext(snapshot.context);

        if (!shouldGenerateAI) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const result = await callLlmForJSON<AIInsightsResult>(
          `Taste context (do not invent extra title lists):
${snapshot.generated.compactForChat || JSON.stringify(snapshot.context)}

Output JSON only:
{"personaLine":"6-8 word present-tense identity statement","insights":["1 sentence","1 sentence","1 sentence"]}`,
          loadSkill('taste-insight') || 'You are a film analyst. Be specific and wry.'
        );

        if (cancelled) return;
        if (result?.personaLine) {
          setPersonaLine(result.personaLine);
          const cards = Array.isArray(result.insights) ? result.insights.slice(0, 3) : [];
          setInsightCards(cards);
          await recordTasteEvent(
            user.uid,
            { type: 'identity', personaLine: result.personaLine, insightCards: cards },
            { email: user.email }
          );
        }
      } catch (err) {
        console.warn('useUserInsights failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, snapshot.identity.personaLine, snapshot.generated.updatedAt, snapshot.generated.insightCards, snapshot.generated.compactForChat, snapshot.context]);

  return { stats, tasteProfile, personaLine, insightCards, isLoading };
}
