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
import { Loader2, Check, Film } from 'lucide-react';

type FilmItem = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
};

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
      // silent — never block onboarding
    }
  }, [user, isAvailable, claimHandle]);

  const goToAiPage = useCallback(async () => {
    setAiLoading(true);
    setPage(2);
    const system =
      "You are a film-savvy friend. Read someone's taste from their film choice and respond with dry wit. ONE sentence, max 10 words. Wry, not flattering. No 'I see you like' opener. Like a film critic friend texting back.";
    const prompt = `The user picked: ${q1Films.map((f) => `${f.title} (${f.year})`).join(', ')}. Write ONE reaction line, max 10 words.`;
    const result = await callClaude(prompt, system);
    setAiLine(result);
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

  const PageDots = () => (
    <div className="absolute top-4 right-4 flex gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i === page ? 'bg-white' : 'bg-white/20'
          }`}
        />
      ))}
    </div>
  );

  const CTAButton = ({
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
    <div
      className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <button
        onClick={onPress}
        disabled={disabled || loading}
        className={`w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-opacity ${
          disabled || loading ? 'opacity-40' : 'opacity-100'
        }`}
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : label}
      </button>
    </div>
  );

  if (page === 0) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <img src="/selects-logo.png" alt="Selects" className="h-12 w-auto" />
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-white">Your cinema. Understood.</h1>
            <p className="text-gray-400 text-sm">A few questions to get started.</p>
          </div>
          <button
            onClick={() => setPage(1)}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl mt-4"
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  if (page === 1) {
    return (
      <div key={1} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="px-5 pt-12 pb-3">
          <h2 className="text-xl font-bold text-white leading-snug">
            If you were alone in a theater — same film, on repeat — what would it be?
          </h2>
          <p className="text-xs text-gray-500 mt-1">Pick 1–3 films</p>
        </div>
        <div className="flex-1 relative min-h-0">
          <FilmPickerScroll selected={q1Films} onToggle={toggleQ1} maxSelect={3} />
        </div>
        <CTAButton
          label="Next"
          onPress={goToAiPage}
          disabled={q1Films.length < 1}
        />
      </div>
    );
  }

  if (page === 2) {
    return (
      <div key={2} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <span className="text-gray-400 text-xs uppercase tracking-widest">Based on your picks</span>
          {aiLoading ? (
            <Loader2 className="animate-spin text-purple-400" size={24} />
          ) : (
            <p className="text-2xl font-black text-white text-center leading-tight italic">
              {aiLine ?? 'Interesting taste.'}
            </p>
          )}
        </div>
        <CTAButton
          label="Next"
          onPress={() => setPage(3)}
          disabled={aiLoading}
        />
      </div>
    );
  }

  if (page === 3) {
    return (
      <div key={3} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="px-5 pt-12 pb-3">
          <h2 className="text-xl font-bold text-white leading-snug">
            Every generation has that film. The one everyone loved. But not you.
          </h2>
          <p className="text-xs text-gray-500 mt-1">Which one didn&apos;t catch your taste?</p>
        </div>
        <div className="flex-1 relative min-h-0">
          <FilmPickerScroll selected={q2Films} onToggle={toggleQ2} maxSelect={2} />
        </div>
        <CTAButton label="Next" onPress={() => setPage(4)} />
      </div>
    );
  }

  if (page === 4) {
    const options: { value: 'story' | 'visual' | 'mood'; label: string; sub: string }[] = [
      { value: 'story', label: 'A great story', sub: 'Writing, characters, plot' },
      { value: 'visual', label: 'A great experience', sub: 'Visuals, sound, atmosphere' },
      { value: 'mood', label: 'Depends on my mood', sub: 'Both, honestly' },
    ];
    return (
      <div key={4} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="px-5 pt-12 pb-3">
          <h2 className="text-xl font-bold text-white leading-snug">
            When you choose a film, what do you actually look for?
          </h2>
        </div>
        <div className="flex-1 px-5 flex flex-col gap-3 pt-4">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilmPref(opt.value)}
              className={`w-full bg-[#18181b] border rounded-2xl p-5 text-left transition-colors ${
                filmPref === opt.value
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-white/10'
              }`}
            >
              <p className="text-white font-semibold text-base">{opt.label}</p>
              <p className="text-gray-400 text-sm mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>
        <CTAButton
          label="Continue"
          onPress={saveAndAdvance}
          disabled={filmPref === null}
          loading={saving}
        />
      </div>
    );
  }

  if (page === 5) {
    return (
      <div key={5} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
          <Film size={48} className="text-[#00e054]" />
          <h2 className="text-2xl font-black text-white text-center">Already logging on Letterboxd?</h2>
          <p className="text-gray-400 text-sm text-center leading-relaxed">
            Import your watched films and ratings. We&apos;ll use them to understand your taste.
          </p>
          <div className="w-full flex flex-col gap-3 mt-2">
            <input
              type="text"
              value={lbUsername}
              onChange={(e) => setLbUsername(e.target.value)}
              placeholder="Your Letterboxd username"
              className="bg-[#18181b] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 w-full focus:border-purple-500 outline-none"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              onClick={handleLetterboxdImport}
              disabled={lbStatus === 'loading' || lbImporting}
              className={`w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-opacity ${
                lbStatus === 'loading' || lbImporting ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {lbStatus === 'loading' || lbImporting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : lbStatus === 'done' ? (
                <>
                  <Check size={18} />
                  Imported
                </>
              ) : (
                'Import Letterboxd'
              )}
            </button>
          </div>
          {lbStatus === 'error' && (
            <p className="text-red-400 text-sm text-center">
              Could not import. Check the username and try again.
            </p>
          )}
        </div>
        <div
          className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setPage(6)}
            className="text-gray-500 text-sm underline text-center w-full py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (page === 6) {
    return (
      <div key={6} className="min-h-screen bg-[#09090b] flex flex-col relative">
        <PageDots />
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">
          <div className="w-12 h-12 rounded-full bg-[#f5c518]/10 flex items-center justify-center">
            <span className="text-[#f5c518] font-black text-xl">i</span>
          </div>
          <h2 className="text-2xl font-black text-white text-center">Import your IMDB ratings?</h2>
          <p className="text-gray-400 text-sm text-center leading-relaxed">
            Export your ratings from IMDB as a CSV and upload it here. We&apos;ll sync your history.
          </p>
          <div className="w-full mt-2">
            <label
              className={`w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-opacity ${
                imdbStatus === 'loading' ? 'opacity-40 pointer-events-none' : 'opacity-100'
              }`}
            >
              {imdbStatus === 'loading' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : imdbStatus === 'done' ? (
                <>
                  <Check size={18} />
                  Imported
                </>
              ) : (
                'Upload CSV'
              )}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleIMDBFile}
                disabled={imdbStatus === 'loading'}
              />
            </label>
          </div>
          {imdbStatus === 'error' && (
            <p className="text-red-400 text-sm text-center">
              Could not import. Make sure it&apos;s a valid IMDB CSV export.
            </p>
          )}
        </div>
        <div
          className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => {
              tryClaimHandleSilently();
              finish();
            }}
            className="text-gray-500 text-sm underline text-center w-full py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return null;
}
