import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { callClaude } from '../lib/claude';
import { useLetterboxdImport } from '../hooks/useLetterboxdImport';
import { useIMDBImport } from '../hooks/useIMDBImport';
import { useHandle, normalizeHandle, isValidHandle } from '../hooks/useHandle';
import FilmPickerScroll from '../components/FilmPickerScroll';
import Armature from '../components/Armature';
import { BarUnit, Button, Input, Mark, Skeleton } from '../components/ui';

type FilmItem = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
};

const ARMATURE = ['mark', 'screen', 'screen', 'broken', 'fan', 'stack', 'stack'] as const;

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/app';
  const { user } = useAuth();

  const [page, setPage] = useState(0);
  const [q1Films, setQ1Films] = useState<FilmItem[]>([]);
  const [q2Films, setQ2Films] = useState<FilmItem[]>([]);
  const [filmPref, setFilmPref] = useState<'story' | 'visual' | 'mood' | null>(null);
  const [aiLine, setAiLine] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lbUsername, setLbUsername] = useState('');
  const [lbStatus, setLbStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [imdbStatus, setImdbStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const { importFromLetterboxd, isImporting: lbImporting } = useLetterboxdImport();
  const { importFromCSV } = useIMDBImport();
  const { claimHandle, isAvailable } = useHandle();

  const finish = useCallback(() => {
    sessionStorage.removeItem('isNewUser');
    sessionStorage.removeItem('pendingInviteCode');
    navigate(nextPath, { replace: true });
  }, [navigate, nextPath]);

  const tryClaimHandleSilently = useCallback(async () => {
    if (!user) return;
    try {
      const raw = user.displayName ?? user.email?.split('@')[0] ?? '';
      const lower = normalizeHandle(raw);
      if (!isValidHandle(lower)) return;
      const available = await isAvailable(lower);
      if (available) await claimHandle(lower);
    } catch {
      // silent
    }
  }, [user, isAvailable, claimHandle]);

  const goToAiPage = useCallback(async () => {
    setAiLoading(true);
    setPage(2);
    const system =
      "You are a film-savvy friend. Read someone's taste from their film choice and respond with dry wit. ONE sentence, max 10 words. Wry, not flattering. No 'I see you like' opener. Like a film critic friend texting back.";
    const prompt = `The user picked: ${q1Films.map((f) => `${f.title} (${f.year})`).join(', ')}. Write ONE reaction line, max 10 words.`;
    try {
      const result = await Promise.race([
        callClaude(prompt, system),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      setAiLine(result);
    } catch {
      setAiLine(null);
    }
    setAiLoading(false);
  }, [q1Films]);

  const saveAndAdvance = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'profile_data', 'taste_profile'),
        {
          onboardingCompleted: true,
          favoriteFilms: q1Films,
          dislikedFilms: q2Films,
          filmPreference: filmPref,
          aiPersonaLine: aiLine,
          completedAt: serverTimestamp(),
          version: 1,
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to save taste profile:', e);
    } finally {
      setSaving(false);
    }
    setPage(5);
  }, [user, q1Films, q2Films, filmPref, aiLine]);

  const handleLetterboxdImport = useCallback(async () => {
    if (!lbUsername.trim()) {
      setPage(6);
      return;
    }
    setLbStatus('loading');
    try {
      await importFromLetterboxd(lbUsername.trim());
      setLbStatus('done');
    } catch {
      setLbStatus('error');
    }
    setTimeout(() => setPage(6), 1500);
  }, [lbUsername, importFromLetterboxd]);

  const handleIMDBFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImdbStatus('loading');
      try {
        const text = await file.text();
        await importFromCSV(text, 'imdb-ratings');
        setImdbStatus('done');
      } catch {
        setImdbStatus('error');
      }
      setTimeout(() => finish(), 1500);
    },
    [importFromCSV, finish]
  );

  function toggleQ1(film: FilmItem) {
    setQ1Films((prev) => {
      const exists = prev.find((f) => f.id === film.id);
      if (exists) return prev.filter((f) => f.id !== film.id);
      if (prev.length >= 3) return prev;
      return [...prev, film];
    });
  }

  function toggleQ2(film: FilmItem) {
    setQ2Films((prev) => {
      const exists = prev.find((f) => f.id === film.id);
      if (exists) return prev.filter((f) => f.id !== film.id);
      if (prev.length >= 2) return prev;
      return [...prev, film];
    });
  }

  const Progress = () => (
    <div className="flex gap-1.5 px-7 pt-6" aria-label="Onboarding progress">
      {Array.from({ length: 7 }).map((_, i) => (
        <BarUnit key={i} state={i === page ? 'on' : i < page ? 'on' : 'empty'} />
      ))}
    </div>
  );

  const CTA = ({
    label,
    onPress,
    disabled,
    loading,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <div className="px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Button className="w-full" onClick={onPress} disabled={disabled} loading={loading} data-testid="onboarding-cta">
        {label}
      </Button>
    </div>
  );

  if (page === 0) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center px-7" data-testid="onboarding-0">
        <Armature state="mark" />
        <Mark variant="lockup" size={40} className="mt-6" />
        <p className="mt-4 text-center font-display text-xl text-fg">
          Selects reads you, and hands you the take worth keeping.
        </p>
        <Button className="w-full max-w-sm mt-8" onClick={() => setPage(1)} data-testid="onboarding-cta">
          Begin
        </Button>
      </div>
    );
  }

  if (page === 1) {
    return (
      <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-1">
        <Progress />
        <Armature state={ARMATURE[1]} />
        <div className="px-7 pb-3">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Your theatre</p>
          <h2 className="font-display text-xl text-fg leading-snug mt-1">
            If you were alone in a theater — same film, on repeat — what would it be?
          </h2>
        </div>
        <div className="flex-1 relative min-h-0">
          <FilmPickerScroll selected={q1Films} onToggle={toggleQ1} maxSelect={3} />
        </div>
        <CTA label="Next" onPress={goToAiPage} disabled={q1Films.length < 1} />
      </div>
    );
  }

  if (page === 2) {
    return (
      <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-2">
        <Progress />
        <Armature state="fan" />
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Reading</p>
          {aiLoading ? (
            <Skeleton className="h-8 w-56" />
          ) : (
            <p className="font-display text-2xl text-fg text-center leading-tight">{aiLine ?? 'Interesting taste.'}</p>
          )}
        </div>
        <CTA label="Next" onPress={() => setPage(3)} disabled={aiLoading} />
      </div>
    );
  }

  if (page === 3) {
    return (
      <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-3">
        <Progress />
        <Armature state={ARMATURE[3]} />
        <div className="px-7 pb-3">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Everyone but you</p>
          <h2 className="font-display text-xl text-fg leading-snug mt-1">
            Every generation has that film. The one everyone loved. But not you.
          </h2>
        </div>
        <div className="flex-1 relative min-h-0">
          <FilmPickerScroll selected={q2Films} onToggle={toggleQ2} maxSelect={2} />
        </div>
        <CTA label="Next" onPress={() => setPage(4)} />
      </div>
    );
  }

  if (page === 4) {
    const options: { value: 'story' | 'visual' | 'mood'; label: string; sub: string }[] = [
      { value: 'story', label: 'A flawless screenplay', sub: 'Structure · dialogue · the writing' },
      { value: 'visual', label: 'The room and the projection', sub: '70mm · the crowd · the dark' },
      { value: 'mood', label: 'Both, depending on the night', sub: 'And I will tell you which' },
    ];
    return (
      <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-4">
        <Progress />
        <Armature state={ARMATURE[4]} />
        <div className="px-7 pb-3">
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">What you go for</p>
          <h2 className="font-display text-xl text-fg leading-snug mt-1">When you choose a film, what do you actually look for?</h2>
        </div>
        <div className="flex-1 px-7 flex flex-col gap-2 pt-4">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilmPref(opt.value)}
              className={`w-full min-h-11 border p-4 text-left ${
                filmPref === opt.value ? 'border-fg bg-base-3' : 'border-line bg-base-2'
              }`}
            >
              <p className="text-fg font-display">{opt.label}</p>
              <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mt-1">{opt.sub}</p>
            </button>
          ))}
        </div>
        <CTA label="Continue" onPress={saveAndAdvance} disabled={filmPref === null} loading={saving} />
      </div>
    );
  }

  if (page === 5) {
    return (
      <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-5">
        <Progress />
        <Armature state="stack" />
        <div className="flex-1 flex flex-col items-center justify-center px-7 gap-4">
          <h2 className="font-display text-2xl text-fg text-center">Already logging on Letterboxd?</h2>
          <p className="text-fg-2 text-sm text-center">Username first. Skip stays skippable.</p>
          <Input
            value={lbUsername}
            onChange={(e) => setLbUsername(e.target.value)}
            placeholder="Letterboxd username"
            aria-label="Letterboxd username"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Button className="w-full" onClick={handleLetterboxdImport} loading={lbStatus === 'loading' || lbImporting}>
            {lbStatus === 'done' ? 'Imported' : 'Import Letterboxd'}
          </Button>
          {lbStatus === 'error' && <p className="text-fg-2 text-sm">Could not import. Check the username.</p>}
        </div>
        <button
          type="button"
          onClick={() => setPage(6)}
          className="min-h-11 pb-8 font-spec text-[10px] uppercase tracking-widest text-fg-3"
          data-testid="onboarding-skip-lb"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex flex-col" data-testid="onboarding-6">
      <Progress />
      <Armature state="stack" />
      <div className="flex-1 flex flex-col items-center justify-center px-7 gap-4">
        <h2 className="font-display text-2xl text-fg text-center">Import your IMDB ratings?</h2>
        <p className="text-fg-2 text-sm text-center">CSV export. Optional.</p>
        <label className="w-full cursor-pointer" htmlFor="imdb-csv">
          <span className="sr-only">Upload CSV</span>
          <span className="inline-flex w-full min-h-11 items-center justify-center bg-fg text-base text-sm font-semibold">
            {imdbStatus === 'done' ? 'Imported' : imdbStatus === 'loading' ? 'Working' : 'Upload CSV'}
          </span>
          <input
            id="imdb-csv"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleIMDBFile}
            disabled={imdbStatus === 'loading'}
          />
        </label>
        {imdbStatus === 'error' && <p className="text-fg-2 text-sm">Could not import that CSV.</p>}
      </div>
      <button
        onClick={() => {
          tryClaimHandleSilently();
          finish();
        }}
        className="min-h-11 pb-8 font-spec text-[10px] uppercase tracking-widest text-fg-3"
        data-testid="onboarding-skip"
      >
        Skip
      </button>
    </div>
  );
}
