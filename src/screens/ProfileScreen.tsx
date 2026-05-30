import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
    <div className="w-16 aspect-[2/3] rounded-lg overflow-hidden bg-[#27272a] shrink-0">
      {src ? (
        <img src={src} alt={title ?? ''} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film size={16} className="text-gray-600" />
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">
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
  const avatarLetter = displayName.charAt(0).toUpperCase();

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
    <div className="min-h-screen bg-[#09090b] text-white max-w-md mx-auto relative overflow-x-hidden">
      <div className="relative h-48 bg-gradient-to-b from-purple-950/50 via-[#09090b]/80 to-[#09090b]">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/30 text-gray-300 hover:text-white transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          {profile?.profileImage ? (
            <img
              src={profile.profileImage}
              alt={displayName}
              className="w-20 h-20 rounded-full border-2 border-white/20 object-cover bg-[#27272a]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-white/20 bg-[#27272a] flex items-center justify-center">
              <span className="text-2xl font-bold text-white/70">{avatarLetter}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-14 pb-2 flex flex-col items-center gap-1 px-4">
        {handle ? (
          <span className="text-purple-400 text-sm font-mono">@{handle}</span>
        ) : (
          <span className="text-gray-500 text-sm font-mono cursor-pointer hover:text-purple-400 transition-colors">
            Set a handle
          </span>
        )}
        <h1 className="text-white font-bold text-lg">{displayName}</h1>
        {isLoading ? (
          <div className="h-4 w-48 bg-[#27272a] animate-pulse rounded-full" />
        ) : personaLine ? (
          <p className="text-gray-400 text-sm italic text-center">{personaLine}</p>
        ) : null}
      </div>

      <div className="px-4 mt-4 space-y-6 pb-24">
        <div className="bg-[#18181b] rounded-2xl p-4 flex items-stretch">
          {isLoading ? (
            <div className="flex-1 h-14 bg-[#27272a] animate-pulse rounded-xl" />
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center">
                <span className="text-white text-2xl font-black">{stats?.watchedCount ?? 0}</span>
                <span className="text-gray-500 text-xs mt-0.5">watched</span>
              </div>
              <div className="w-px bg-white/10 self-stretch" />
              <div className="flex-1 flex flex-col items-center">
                <span className="text-white text-2xl font-black">{stats?.watchlistCount ?? 0}</span>
                <span className="text-gray-500 text-xs mt-0.5">watchlist</span>
              </div>
              <div className="w-px bg-white/10 self-stretch" />
              <div className="flex-1 flex flex-col items-center">
                <span className="text-white text-2xl font-black">
                  {stats?.watchedCount ? `${stats.likedPercent}%` : '—'}
                </span>
                <span className="text-gray-500 text-xs mt-0.5">loved</span>
              </div>
            </>
          )}
        </div>

        {!isLoading && !hasData ? (
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
            <Film size={32} className="text-gray-600" />
            <p className="text-gray-400 text-sm">Watch some films first</p>
            <button
              onClick={() => navigate('/app')}
              className="text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors"
            >
              Start discovering
            </button>
          </div>
        ) : null}

        {(isLoading || insightCards.length > 0) && (
          <div>
            <SectionLabel>Taste DNA</SectionLabel>
            <div className="space-y-3">
              {isLoading
                ? [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse bg-[#27272a] h-16 rounded-2xl"
                    />
                  ))
                : insightCards.map((card, i) => {
                    const Icon = TASTE_DNA_ICONS[i] ?? Sparkles;
                    return (
                      <div
                        key={i}
                        className="bg-[#18181b] border border-white/10 rounded-2xl p-4 flex items-start gap-3"
                      >
                        <Icon size={18} className="text-purple-400 mt-0.5 shrink-0" />
                        <p className="text-gray-200 text-sm leading-relaxed">{card}</p>
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
          <div className="bg-[#18181b] rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">Looking for</p>
            <p className="text-white font-bold">{filmPrefLabel[filmPref]}</p>
          </div>
        )}

        <div>
          <SectionLabel>Import history</SectionLabel>
          <div className="space-y-3">
            <div className="bg-[#18181b] border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => setLbOpen((v) => !v)}
                className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
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
                      className="flex-1 bg-[#27272a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-600 transition-colors"
                      onKeyDown={(e) => e.key === 'Enter' && handleLetterboxdImport()}
                    />
                    <button
                      onClick={handleLetterboxdImport}
                      disabled={lbImporting || !lbUsername.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
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

            <div className="bg-[#18181b] border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => setImdbOpen((v) => !v)}
                className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
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
                    className="w-full py-2 px-4 bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 text-white text-sm rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10"
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
            className="text-purple-400 text-sm hover:text-purple-300 transition-colors"
          >
            Update your picks
          </button>
        </div>
      </div>
    </div>
  );
}
