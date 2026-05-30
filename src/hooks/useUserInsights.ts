import { useState, useEffect } from 'react';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { callClaudeForJSON } from '../lib/claude';

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
  const [stats, setStats] = useState<InsightsStats | null>(null);
  const [tasteProfile, setTasteProfile] = useState<any | null>(null);
  const [personaLine, setPersonaLine] = useState<string | null>(null);
  const [insightCards, setInsightCards] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        const [watchedSnap, watchlistSnap, tasteProfileDoc] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'watched_recommendations')),
          getDocs(collection(db, 'users', user.uid, 'watchlist')),
          getDoc(doc(db, 'users', user.uid, 'profile_data', 'taste_profile')),
        ]);

        if (cancelled) return;

        const watchedDocs = watchedSnap.docs.map((d) => d.data());
        const watchedCount = watchedDocs.length;
        const watchlistCount = watchlistSnap.size;

        const likedCount = watchedDocs.filter((d) => d.rating === 'up').length;
        const likedPercent = watchedCount > 0 ? Math.round((likedCount / watchedCount) * 100) : 0;

        const computedStats: InsightsStats = { watchedCount, watchlistCount, likedPercent };

        const rawTasteProfile = tasteProfileDoc.exists() ? tasteProfileDoc.data() : null;

        if (!cancelled) {
          setStats(computedStats);
          setTasteProfile(rawTasteProfile);
        }

        const shouldGenerateAI =
          watchedCount >= 3 || (rawTasteProfile?.favoriteFilms?.length ?? 0) >= 1;

        if (!shouldGenerateAI) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const likedTitles: string[] = watchedDocs
          .filter((d) => d.rating === 'up' && d.title)
          .map((d) => d.title as string)
          .slice(0, 20);

        const dislikedTitles: string[] = watchedDocs
          .filter((d) => d.rating === 'down' && d.title)
          .map((d) => d.title as string)
          .slice(0, 10);

        const onboardingTitles: string[] =
          (rawTasteProfile?.favoriteFilms ?? [])
            .map((f: any) => (typeof f === 'string' ? f : f?.title ?? ''))
            .filter(Boolean)
            .slice(0, 15);

        const filmPref: string = rawTasteProfile?.filmPreference ?? '';

        const systemPrompt =
          'You are a film analyst generating deep, personal taste insights for a cinema app user. Be specific, wry, and data-driven. Never be generic.';

        const prompt = `Generate insights for a user with this film history:
Loved: ${likedTitles.join(', ')}
Disliked: ${dislikedTitles.join(', ')}
Deliberately chose (onboarding): ${onboardingTitles.join(', ')}
Prefers: ${filmPref}

Output JSON only:
{
  "personaLine": "6-8 word present-tense identity statement (wry, specific, not generic)",
  "insights": [
    "1 sentence, 10-15 words, specific pattern from the data",
    "1 sentence, 10-15 words, different angle",
    "1 sentence, 10-15 words, surprising observation"
  ]
}

Rules: personaLine examples: "Slow burns and moral ambiguity. Every time.", "Pre-2000 or nothing. Rarely between."
Insight examples: "You've liked 7 films where the protagonist loses in the end.", "Your watchlist skews toward films that flopped theatrically, then found their audience."
Never say 'you seem to' or 'based on your history'. State insights directly.`;

        const result = await callClaudeForJSON<AIInsightsResult>(prompt, systemPrompt);

        if (!cancelled) {
          if (result?.personaLine) setPersonaLine(result.personaLine);
          if (Array.isArray(result?.insights)) setInsightCards(result.insights.slice(0, 3));
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
  }, [user?.uid]);

  return { stats, tasteProfile, personaLine, insightCards, isLoading };
}
