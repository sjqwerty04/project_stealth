import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronRight, Film, Star } from 'lucide-react';
import SelectsChaseLoader from '../components/ui/SelectsChaseLoader';
import TasteMarks, { knownTasteFilms } from '../components/TasteMarks';
import { useAuth } from '../hooks/useAuth';
import { useProfileFilms } from '../hooks/useProfileFilms';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUserInsights } from '../hooks/useUserInsights';
import { useLetterboxdImport } from '../hooks/useLetterboxdImport';
import ImportDropZone from '../components/ImportDropZone';
import { useTaste } from '../lib/taste';
import { tasteVoice } from '../lib/taste/voice';

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-spec text-[32px] uppercase leading-none tracking-tight text-fg">{n}</span>
      <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">{label}</span>
    </div>
  );
}

function AssemblyStage({
  films,
  colour,
  label,
  exposed,
}: {
  films: Array<{ title: string; poster?: string; movieId?: number; mediaType?: string }>;
  colour: string;
  label: string;
  exposed: number;
}) {
  const nodes = films.slice(0, 8);
  const orbit = 64;
  return (
    <div className="assembly-stage relative mt-4 overflow-hidden" data-testid="you-assembly-stage">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[148px] w-[148px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
        style={{ borderColor: colour }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-spec text-[34px] leading-none tracking-tight text-fg">{exposed}%</p>
        <p className="mt-1 font-spec text-[10px] uppercase tracking-widest text-fg-3">{label}</p>
      </div>
      {nodes.map((film, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(nodes.length, 1)) * Math.PI * 2;
        const x = Math.cos(angle) * orbit;
        const y = Math.sin(angle) * (orbit * 0.82);
        const initial = (film.title.trim()[0] || '·').toUpperCase();
        return (
          <span
            key={`${film.title}-${index}`}
            className="absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border-2 bg-base-3"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, borderColor: colour }}
            title={film.title}
          >
            {film.poster ? (
              <img src={film.poster} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-spec text-[11px] text-fg">{initial}</span>
            )}
          </span>
        );
      })}
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
  const { snapshot, loading: tasteLoading } = useTaste();
  const profileFilms = useProfileFilms();
  const voice = tasteVoice(snapshot);
  const tasteFilms = knownTasteFilms(profileFilms, snapshot);
  const {
    importFromLetterboxd,
    isImporting: lbImporting,
    progress: lbProgress,
    error: lbError,
  } = useLetterboxdImport();
  const [lbUsername, setLbUsername] = useState('');
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSuccess, setLbSuccess] = useState<number | null>(null);

  const [imdbOpen, setImdbOpen] = useState(false);

  const displayName =
    profile?.displayName ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'You';
  const handle = profile?.handle ?? null;

  const handleLetterboxdImport = async () => {
    const trimmed = lbUsername.trim();
    if (!trimmed) return;
    const summary = await importFromLetterboxd(trimmed);
    if (summary.films > 0) {
      setLbSuccess(summary.films);
      setTimeout(() => {
        setLbOpen(false);
        setLbUsername('');
        setLbSuccess(null);
      }, 2500);
    }
  };

  const { stats, isLoading, tasteProfile } = insights;
  const pageLoading = isLoading || tasteLoading;
  const hasData = !voice.empty || (stats?.watchedCount ?? 0) > 0;
  const [selectsProfile, setSelectsProfile] = useState<{ archetype: string | null; read: string | null; colour: string | null } | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    void getDoc(doc(db, 'users', user.uid, 'profile_data', 'selects_profile')).then((snap) => {
      const data = snap.data() as { profile?: { archetype?: string | null; read?: string }; stats?: { colourHex?: string } } | undefined;
      setSelectsProfile({
        archetype: typeof data?.profile?.archetype === 'string' ? data.profile.archetype : null,
        read: typeof data?.profile?.read === 'string' ? data.profile.read : null,
        colour: typeof data?.stats?.colourHex === 'string' ? data.stats.colourHex : null,
      });
    });
  }, [user?.uid]);
  const colour = selectsProfile?.colour || '#3A6E85';
  const profileDoc = tasteProfile as { favoriteFilms?: unknown[]; dislikedFilms?: unknown[]; lightsDownHour?: number } | null;
  const keptCount = Array.isArray(profileDoc?.favoriteFilms) ? profileDoc.favoriteFilms.length : voice.keep.length;
  const struckCount = Array.isArray(profileDoc?.dislikedFilms) ? profileDoc.dislikedFilms.length : voice.leave.length;
  const loggedCount = stats?.watchedCount ?? 0;
  const hour = typeof profileDoc?.lightsDownHour === 'number' ? profileDoc.lightsDownHour : null;
  const hourLabel = hour == null ? '—' : `${((hour + 11) % 12) + 1} ${hour >= 12 ? 'PM' : 'AM'}`;
  const initial = (displayName.trim()[0] || 'Y').toUpperCase();
  const archWord = selectsProfile?.archetype || (voice.axis === 'mood' ? 'Mood first' : voice.axis === 'visual' ? 'The room' : voice.axis === 'story' ? 'The writing' : 'Your read');
  const readLine = selectsProfile?.read || voice.lead;
  const exposed = Math.min(100, keptCount * 12 + struckCount * 8 + loggedCount * 20 + (hour == null ? 0 : 10));

  return (
    <div className="you-page relative min-h-screen max-w-md mx-auto overflow-x-hidden bg-base text-fg" data-testid="you-screen" style={{ ['--you' as string]: colour }}>
      <header className="relative px-5 pb-2 pt-6">
        <div className="flex items-center gap-3.5">
          <span className="grid h-[52px] w-[52px] place-items-center text-[22px] font-extrabold text-base" style={{ background: colour }} data-testid="you-swatch">{initial}</span>
          <div className="min-w-0">
            <h1 className="break-words font-display text-[22px] font-semibold leading-none tracking-tight text-fg">{displayName}</h1>
            {handle ? <p className="mt-1 font-spec text-[10px] uppercase tracking-widest text-fg-3">@{handle}</p> : <p className="mt-1 font-spec text-[10px] uppercase tracking-widest text-fg-3">Set a handle</p>}
          </div>
        </div>
        {pageLoading ? (
          <div className="mt-6 h-16 w-full bg-base-3" data-testid="skeleton" />
        ) : (
          <>
            <div className="you-fit">
              <p className="you-arch font-display uppercase" style={{ ['--n' as string]: String(Math.max(archWord.length, 4)), color: colour }} data-testid="profile-archetype">{archWord}</p>
            </div>
            <p className="max-w-[28ch] text-[18px] leading-snug text-fg" data-testid="insights-label">{readLine}</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4 border-t border-line pt-4">
          <Stat n={pageLoading ? '—' : String(keptCount)} label="kept" />
          <Stat n={pageLoading ? '—' : String(struckCount)} label="struck" />
          <Stat n={pageLoading ? '—' : String(loggedCount)} label="logged" />
          <Stat n={hourLabel} label="lights down" />
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-7" style={{ background: colour }} />
            <span className="font-spec text-lg uppercase tracking-tight text-fg">{colour}</span>
            <span className="font-spec text-[10px] uppercase tracking-widest text-fg-3">your colour</span>
          </div>
        </div>
      </header>

      <section className="px-5 pt-6" data-testid="you-assembly">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[28px] font-bold tracking-tight text-fg">The Assembly</h2>
            <p className="mt-1 text-sm text-fg-2">How well Selects knows you, craft by craft.</p>
          </div>
          <span className="shrink-0 font-spec text-[10px] uppercase tracking-widest text-fg-3">
            <b className="font-spec text-sm text-fg">{pageLoading ? '—' : `${exposed}%`}</b> exposed
          </span>
        </div>
        <AssemblyStage
          films={tasteFilms}
          colour={colour}
          label={(displayName.split(' ')[0] || 'You').length > 12 ? 'You' : (displayName.split(' ')[0] || 'You')}
          exposed={pageLoading ? 0 : exposed}
        />
      </section>

      <div className="mt-8 space-y-6 px-5 pb-8">

        {!pageLoading && !hasData ? (
          <div className="border border-line p-8 flex flex-col items-center gap-3 text-center">
            <Film size={32} className="text-fg-3" />
            <p className="text-fg-2 text-sm" data-testid="profile-body">{voice.profileBody}</p>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="min-h-11 text-fg text-sm font-medium"
            >
              Open selects
            </button>
          </div>
        ) : null}

        {!pageLoading && hasData ? (
          <div>
            <SectionLabel>The read</SectionLabel>
            <p className="text-fg text-sm leading-relaxed" data-testid="profile-body">{voice.profileBody}</p>
            {voice.keep.length > 0 && (
              <div className="mt-4">
                <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-2">Keeping</p>
                <TasteMarks titles={voice.keep} films={tasteFilms} onOpen={(id, type) => navigate(`/movie/${id}${type ? `?type=${type}` : ''}`)} />
              </div>
            )}
            {voice.leave.length > 0 && (
              <div className="mt-4">
                <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-2">Leaving</p>
                <TasteMarks titles={voice.leave} films={tasteFilms} onOpen={(id, type) => navigate(`/movie/${id}${type ? `?type=${type}` : ''}`)} />
              </div>
            )}
          </div>
        ) : null}

        <div>
          <SectionLabel>{voice.importLine}</SectionLabel>
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
                  <p className="text-gray-400 text-xs">Username or the full export</p>
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
                      {lbImporting ? <SelectsChaseLoader size="xs" activeColor="#000000" idleColor="#666666" /> : 'Import'}
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
                  <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mt-4 mb-2">Or drop the full export</p>
                  <ImportDropZone compact testId="profile-letterboxd-drop" />
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
                  <p className="text-gray-400 text-xs">ratings.csv</p>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-500 transition-transform ${imdbOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {imdbOpen && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                  <ImportDropZone compact testId="profile-imdb-drop" />
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
            {voice.retakeLine}
          </button>
        </div>
      </div>
    </div>
  );
}
