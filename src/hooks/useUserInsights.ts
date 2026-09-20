import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { callLlmForJSON } from '../lib/llm';
import { loadSkill } from '../lib/skills';
import { hasMeaningfulContext, recordTasteEvent, SNAPSHOT_FRESH_MS, useTaste } from '../lib/taste';

export type TasteProfileFilm = { title?: string; posterPath?: string; poster_path?: string };

export type TasteProfile = {
  aiPersonaLine: string | null;
  favoriteFilms: (string | TasteProfileFilm)[];
  dislikedFilms: (string | TasteProfileFilm)[];
  filmPreference: string | null;
};

type AIInsightsResult = {
  personaLine: string;
  insights: string[];
};

export type UserInsights = {
  tasteProfile: TasteProfile | null;
  personaLine: string | null;
  insightCards: string[];
  isLoading: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function filmList(value: unknown): (string | TasteProfileFilm)[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string | TasteProfileFilm => typeof entry === 'string' || isRecord(entry));
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseTasteProfile(raw: unknown): TasteProfile | null {
  if (!isRecord(raw)) return null;
  return {
    aiPersonaLine: optionalText(raw.aiPersonaLine),
    favoriteFilms: filmList(raw.favoriteFilms),
    dislikedFilms: filmList(raw.dislikedFilms),
    filmPreference: optionalText(raw.filmPreference),
  };
}

export function useUserInsights(): UserInsights {
  const { user } = useAuth();
  const { snapshot } = useTaste();
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
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

  const uid = user?.uid;
  const email = user?.email;

  useEffect(() => {
    if (!uid) {
      setTasteProfile(null);
      setPersonaLine(null);
      setInsightCards([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const tasteProfileDoc = await getDoc(doc(db, 'users', uid, 'profile_data', 'taste_profile'));
        if (cancelled) return;

        const profile = tasteProfileDoc.exists() ? parseTasteProfile(tasteProfileDoc.data()) : null;
        setTasteProfile(profile);

        const storedLine = snapshot.identity.personaLine || profile?.aiPersonaLine || null;
        const storedCards = snapshot.generated.insightCards;
        const fresh =
          snapshot.generated.updatedAt != null &&
          Date.now() - snapshot.generated.updatedAt < SNAPSHOT_FRESH_MS;

        if (storedLine) setPersonaLine(storedLine);
        if (storedCards.length) setInsightCards(storedCards);

        const shouldGenerateAI = !fresh && !storedLine && hasMeaningfulContext(snapshot.context);

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
            uid,
            { type: 'identity', personaLine: result.personaLine, insightCards: cards },
            { email }
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
  }, [
    uid,
    email,
    snapshot.identity.personaLine,
    snapshot.generated.updatedAt,
    snapshot.generated.insightCards,
    snapshot.generated.compactForChat,
    snapshot.context,
  ]);

  return { tasteProfile, personaLine, insightCards, isLoading };
}
