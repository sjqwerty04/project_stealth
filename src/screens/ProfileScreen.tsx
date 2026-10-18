import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const { stats, isLoading } = insights;
  const pageLoading = isLoading || tasteLoading;
  const hasData = !voice.empty || (stats?.watchedCount ?? 0) > 0;

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
        {pageLoading ? (
          <div className="h-4 w-48 bg-base-3 mt-2" data-testid="skeleton" />
        ) : (
          <p className="text-fg-2 text-sm mt-2" data-testid="insights-label">{voice.lead}</p>
        )}
      </div>

      <div className="px-7 mt-2 space-y-6 pb-8">
        <div className="border border-line p-4 flex items-stretch">
          {pageLoading ? (
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
