import { useNavigate } from 'react-router-dom';
import TasteMarks, { knownTasteFilms } from '../components/TasteMarks';
import { useProfileFilms } from '../hooks/useProfileFilms';
import { useTaste } from '../lib/taste';
import { tasteVoice } from '../lib/taste/voice';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { snapshot, loading } = useTaste();
  const profileFilms = useProfileFilms();
  const voice = tasteVoice(snapshot);
  const films = knownTasteFilms(profileFilms, snapshot);
  const open = (movieId: number, mediaType?: string) => {
    navigate(`/movie/${movieId}${mediaType ? `?type=${mediaType}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-base text-fg max-w-md mx-auto" data-testid="settings-screen">
      <div className="px-7 pt-8 pb-4">
        <button
          type="button"
          onClick={() => navigate('/me')}
          className="font-spec text-[10px] uppercase tracking-widest text-fg-3 min-h-11"
        >
          You
        </button>
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">Settings</p>
        {loading ? (
          <div className="h-6 w-48 bg-base-3 mt-2" data-testid="skeleton" />
        ) : (
          <h1 className="font-display text-2xl text-fg mt-1" data-testid="settings-lead">
            {voice.settingsLead}
          </h1>
        )}
      </div>
      <div className="px-7 pb-8 space-y-6">
        <p className="text-fg-2 text-sm leading-relaxed" data-testid="settings-body">
          {loading ? '' : voice.settingsBody}
        </p>
        {voice.keep.length > 0 && (
          <div>
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">Keeping</p>
            <TasteMarks titles={voice.keep} films={films} onOpen={open} />
          </div>
        )}
        {voice.leave.length > 0 && (
          <div>
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">Leaving</p>
            <TasteMarks titles={voice.leave} films={films} onOpen={open} />
          </div>
        )}
        {voice.recent.length > 0 && (
          <div>
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mb-3">Recent marks</p>
            <TasteMarks titles={voice.recent} films={films} onOpen={open} />
          </div>
        )}
      </div>
    </div>
  );
}
