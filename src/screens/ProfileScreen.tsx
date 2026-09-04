import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  Globe,
  Clock,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUserInsights } from '../hooks/useUserInsights';
import { useLetterboxdImport } from '../hooks/useLetterboxdImport';
import { useIMDBImport } from '../hooks/useIMDBImport';

const TASTE_DNA_ICONS = [Film, Globe, Clock];

const filmPrefLabel: Record<string, string> = {
  story: 'A great story',
  visual: 'A great visual experience',
  mood: 'Depends on the mood',
};

function PosterThumb({ posterPath, title }: { posterPath?: string; title?: string }) {
  const src = posterPath
    ? `https://image.tmdb.org/t/p/w200${posterPath}`
    : null;
  return (
    <div className="w-16 aspect-[2/3] overflow-hidden bg-base-3 shrink-0" style={{ borderRadius: 2 }}>
      {src ? (
        <img src={src} alt={title ?? ''} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film size={16} className="text-fg-3" />
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">
      {children}
    </p>
  );
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const insights = useUserInsights();
  const {
    importFromLetterboxd,
    isImporting: lbImporting,
    progress: lbProgress,
    error: lbError,
  } = useLetterboxdImport();
  const {
    importFromCSV,
    isImporting: imdbImporting,
    progress: imdbProgress,
    error: imdbError,
  } = useIMDBImport();

  const [lbUsername, setLbUsername] = useState('');
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSuccess, setLbSuccess] = useState<number | null>(null);

  const [imdbOpen, setImdbOpen] = useState(false);
  const [imdbSuccess, setImdbSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName =
    profile?.displayName ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'You';
  const handle = profile?.handle ?? null;

  const handleLetterboxdImport = async () => {
    const trimmed = lbUsername.trim();
    if (!trimmed) return;
    const count = await importFromLetterboxd(trimmed);
    if (count > 0) {
      setLbSuccess(count);
      setTimeout(() => {
        setLbOpen(false);
        setLbUsername('');
        setLbSuccess(null);
      }, 2500);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const csv = ev.target?.result as string;
      if (!csv) return;
      const count = await importFromCSV(csv, 'imdb-watchlist');
      if (count > 0) {
        setImdbSuccess(count);
        setTimeout(() => {
          setImdbOpen(false);
          setImdbSuccess(null);
        }, 2500);
      }
    };
    reader.readAsText(file);
  };

  const { stats, tasteProfile, personaLine, insightCards, isLoading } = insights;

  const hasData =
    (stats?.watchedCount ?? 0) > 0 ||
    (tasteProfile?.favoriteFilms?.length ?? 0) > 0;

  const favoriteFilms: any[] = tasteProfile?.favoriteFilms ?? [];
  const dislikedFilms: any[] = tasteProfile?.dislikedFilms ?? [];
  const filmPref: string | undefined = tasteProfile?.filmPreference;

  return (
    <div className="min-h-screen bg-base text-fg max-w-md mx-auto relative overflow-x-hidden" data-testid="you-screen">
      <div className="px-7 pt-8 pb-4">
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">You</p>
        {handle ? (
          <p className="font-spec text-xs text-fg-2 mt-2">@{handle}</p>
        ) : (
          <p className="font-spec text-xs text-fg-3 mt-2">Set a handle</p>
        )}
        <h1 className="font-display text-2xl text-fg mt-1">{displayName}</h1>
        {isLoading ? (
          <div className="h-4 w-48 bg-base-3 mt-2" data-testid="skeleton" />
        ) : personaLine ? (
          <p className="text-fg-2 text-sm mt-2" data-testid="insights-label">{personaLine}</p>
        ) : (
          <p className="text-fg-3 text-sm mt-2">Watch some films. The read shows up here.</p>
        )}
      </div>

      <div className="px-7 mt-2 space-y-6 pb-8">
        <div className="border border-line p-4 flex items-stretch">
          {isLoading ? (
            <div className="flex-1 h-14 bg-base-3" data-testid="skeleton" />
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center">
                <span className="text-fg text-2xl font-black">{stats?.watchedCount ?? 0}</span>
                <span className="text-fg-3 text-xs mt-0.5">watched</span>
              </div>
              <div className="w-px bg-line self-stretch" />
              <div className="flex-1 flex flex-col items-center">
                <span className="text-fg text-2xl font-black">{stats?.watchlistCount ?? 0}</span>
                <span className="text-fg-3 text-xs mt-0.5">watchlist</span>
              </div>
              <div className="w-px bg-line self-stretch" />
              <div className="flex-1 flex flex-col items-center">
                <span className="text-fg text-2xl font-black">
                  {stats?.watchedCount ? `${stats.likedPercent}%` : '—'}
                </span>
                <span className="text-fg-3 text-xs mt-0.5">loved</span>
              </div>
            </>
          )}
        </div>

        {!isLoading && !hasData ? (
          <div className="border border-line p-8 flex flex-col items-center gap-3 text-center">
            <Film size={32} className="text-fg-3" />
            <p className="text-fg-2 text-sm">Watch some films first</p>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="min-h-11 text-fg text-sm font-medium"
            >
              Start discovering
            </button>
          </div>
        ) : null}

        {(isLoading || insightCards.length > 0) && (
          <div>
            <SectionLabel>The read</SectionLabel>
            <div className="space-y-3">
              {isLoading
                ? [0, 1, 2].map((i) => (
                    <div key={i} className="bg-base-3 h-16" data-testid="skeleton" />
                  ))
                : insightCards.map((card, i) => {
                    const Icon = TASTE_DNA_ICONS[i] ?? Sparkles;
                    return (
                      <div key={i} className="border border-line p-4 flex items-start gap-3">
                        <Icon size={18} className="text-fg-2 mt-0.5 shrink-0" />
                        <p className="text-fg text-sm leading-relaxed">{card}</p>
                      </div>
                    );
                  })}
            </div>
          </div>
        )}

        {favoriteFilms.length > 0 && (
          <div>
            <SectionLabel>Your picks</SectionLabel>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-2 px-0.5 flex items-center gap-1">
                  <Star size={12} className="text-yellow-500" />
                  Loved
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {favoriteFilms.map((film: any, i: number) => (
                    <PosterThumb
                      key={i}
                      posterPath={film?.posterPath ?? film?.poster_path}
                      title={typeof film === 'string' ? film : film?.title}
                    />
                  ))}
                </div>
              </div>
              {dislikedFilms.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 px-0.5 flex items-center gap-1">
                    <TrendingUp size={12} className="text-gray-500" />
                    Passed
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {dislikedFilms.map((film: any, i: number) => (
                      <PosterThumb
                        key={i}
                        posterPath={film?.posterPath ?? film?.poster_path}
                        title={typeof film === 'string' ? film : film?.title}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {filmPref && filmPrefLabel[filmPref] && (
          <div className="border border-line p-4">
            <p className="text-xs text-gray-400 mb-1">Looking for</p>
            <p className="text-white font-bold">{filmPrefLabel[filmPref]}</p>
          </div>
        )}

        <div>
          <SectionLabel>Import history</SectionLabel>
          <div className="space-y-3">
            <div className="border border-line">
              <button
                type="button"
                onClick={() => setLbOpen((v) => !v)}
                className="w-full min-h-11 p-4 flex items-center gap-3 text-left"
                aria-expanded={lbOpen}
                data-testid="import-letterboxd"
              >
                <div className="w-9 h-9 rounded-full bg-[#00e054]/20 flex items-center justify-center shrink-0">
                  <Film size={16} className="text-[#00e054]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">Letterboxd</p>
                  <p className="text-gray-400 text-xs">Import your watch history</p>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-500 transition-transform ${lbOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {lbOpen && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lbUsername}
                      onChange={(e) => setLbUsername(e.target.value)}
                      placeholder="Letterboxd username"
                      className="flex-1 bg-base-2 border border-line px-3 py-2 text-sm text-fg placeholder-fg-3 outline-none min-h-11"
                      onKeyDown={(e) => e.key === 'Enter' && handleLetterboxdImport()}
                    />
                    <button
                      onClick={handleLetterboxdImport}
                      disabled={lbImporting || !lbUsername.trim()}
                      className="px-4 min-h-11 bg-fg text-base text-sm font-medium flex items-center gap-2 disabled:opacity-40"
                    >
                      {lbImporting ? <Loader2 size={14} className="animate-spin" /> : 'Import'}
                    </button>
                  </div>
                  {lbImporting && (
                    <p className="text-gray-400 text-xs mt-2">
                      Importing... {lbProgress.current > 0 ? `${lbProgress.current}/${lbProgress.total}` : ''}
                    </p>
                  )}
                  {lbError && (
                    <p className="text-red-400 text-xs mt-2">{lbError}</p>
                  )}
                  {lbSuccess !== null && (
                    <p className="text-green-400 text-xs mt-2">
                      Imported {lbSuccess} films
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border border-line">
              <button
                type="button"
                onClick={() => setImdbOpen((v) => !v)}
                className="w-full min-h-11 p-4 flex items-center gap-3 text-left"
                aria-expanded={imdbOpen}
                data-testid="import-imdb"
              >
                <div className="w-9 h-9 rounded-full bg-yellow-400/20 flex items-center justify-center shrink-0">
                  <Star size={16} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">IMDB</p>
                  <p className="text-gray-400 text-xs">Import from CSV export</p>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-500 transition-transform ${imdbOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {imdbOpen && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imdbImporting}
                    className="w-full min-h-11 py-2 px-4 bg-base-3 text-fg text-sm flex items-center justify-center gap-2 border border-line disabled:opacity-40"
                  >
                    {imdbImporting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {imdbProgress.current > 0
                          ? `${imdbProgress.current}/${imdbProgress.total}`
                          : 'Importing...'}
                      </>
                    ) : (
                      'Choose CSV file'
                    )}
                  </button>
                  {imdbError && (
                    <p className="text-red-400 text-xs mt-2">{imdbError}</p>
                  )}
                  {imdbSuccess !== null && (
                    <p className="text-green-400 text-xs mt-2">
                      Imported {imdbSuccess} films
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 pb-4 text-center">
          <button
            onClick={() => navigate('/onboarding?retake=true')}
            className="min-h-11 text-fg-2 text-sm"
          >
            Update your picks
          </button>
        </div>
      </div>
    </div>
  );
}
