import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, ThumbsDown, Loader2, Film, Plus, X, Upload, Calendar } from 'lucide-react';
import { useCalendarLogs, type CalendarEvent } from '../hooks/useCalendarLogs';
import { useLetterboxdImport } from '../hooks/useLetterboxdImport';
import { useIMDBImport, detectImportType, type ImportType } from '../hooks/useIMDBImport';
import LibraryHub from '../components/LibraryHub';
import Skeleton from '../components/ui/Skeleton';

// --- Timeline grouping helpers ---

type WeekGroup = {
  weekLabel: string;
  weekStart: Date;
  movies: CalendarEvent[];
};

type MonthGroup = {
  monthLabel: string;
  monthKey: string;
  weeks: WeekGroup[];
};

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatWeekLabel = (weekStart: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Week of ${months[weekStart.getMonth()]} ${weekStart.getDate()}`;
};

const formatMonthLabel = (date: Date): string => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

const groupByTimeline = (events: CalendarEvent[]): MonthGroup[] => {
  // Sort descending by date
  const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const monthMap = new Map<string, { label: string; weekMap: Map<string, { weekStart: Date; movies: CalendarEvent[] }> }>();

  for (const event of sorted) {
    const eventDate = new Date(event.date);
    const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth()).padStart(2, '0')}`;
    const weekStart = getMonday(eventDate);
    const weekKey = weekStart.toISOString().slice(0, 10);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        label: formatMonthLabel(eventDate),
        weekMap: new Map(),
      });
    }

    const month = monthMap.get(monthKey)!;
    if (!month.weekMap.has(weekKey)) {
      month.weekMap.set(weekKey, { weekStart, movies: [] });
    }
    month.weekMap.get(weekKey)!.movies.push(event);
  }

  // Convert to arrays, keeping descending order
  const result: MonthGroup[] = [];
  for (const [monthKey, { label, weekMap }] of monthMap) {
    const weeks: WeekGroup[] = [];
    // Sort weeks descending
    const sortedWeeks = [...weekMap.entries()].sort((a, b) => b[1].weekStart.getTime() - a[1].weekStart.getTime());
    for (const [, { weekStart, movies }] of sortedWeeks) {
      weeks.push({
        weekLabel: formatWeekLabel(weekStart),
        weekStart,
        movies,
      });
    }
    result.push({ monthLabel: label, monthKey, weeks });
  }

  return result;
};

// --- Component ---

export default function WatchedScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { events, loading: eventsLoading } = useCalendarLogs();
  const { 
    importFromLetterboxd, 
    isImporting: isLetterboxdImporting, 
    progress: letterboxdProgress, 
    error: letterboxdError, 
    importedCount: letterboxdImportedCount 
  } = useLetterboxdImport();
  const { 
    importFromIMDB,
    importFromCSV,
    isImporting: isIMDBImporting, 
    progress: imdbProgress, 
    error: imdbError, 
    importedCount: imdbImportedCount 
  } = useIMDBImport();
  
  const [filter, setFilter] = useState<'all' | 'liked' | 'disliked'>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const [detectedType, setDetectedType] = useState<ImportType>('unknown');
  const [importMode, setImportMode] = useState<'url' | 'csv'>('url');

  const isImporting = isLetterboxdImporting || isIMDBImporting;
  const progress = isLetterboxdImporting ? letterboxdProgress : imdbProgress;
  const importError = isLetterboxdImporting ? letterboxdError : imdbError;
  const importedCount = isLetterboxdImporting ? letterboxdImportedCount : imdbImportedCount;

  // Get watched movies from calendar_logs (has real watch dates)
  const watchedEvents = useMemo(() => {
    return events.filter(e => e.status === 'watched');
  }, [events]);

  // Apply filter
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return watchedEvents;
    if (filter === 'liked') return watchedEvents.filter(e => e.rating === 'up');
    if (filter === 'disliked') return watchedEvents.filter(e => e.rating === 'down');
    return watchedEvents;
  }, [watchedEvents, filter]);

  // Group into timeline
  const timeline = useMemo(() => groupByTimeline(filteredEvents), [filteredEvents]);

  const likedCount = watchedEvents.filter(e => e.rating === 'up').length;
  const dislikedCount = watchedEvents.filter(e => e.rating === 'down').length;

  // Detect import type when URL changes
  useEffect(() => {
    if (importUrl.trim()) {
      setDetectedType(detectImportType(importUrl));
    } else {
      setDetectedType('unknown');
    }
  }, [importUrl]);

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    
    let count = 0;
    
    if (detectedType === 'letterboxd') {
      const match = importUrl.match(/letterboxd\.com\/([^\/]+)/i);
      const username = match ? match[1] : importUrl.trim();
      count = await importFromLetterboxd(username);
    } else if (detectedType === 'imdb-ratings') {
      count = await importFromIMDB(importUrl, 'imdb-ratings');
    } else if (detectedType === 'imdb-watchlist') {
      navigate('/watchlist');
      return;
    }

    if (count > 0) {
      setImportSuccess(count);
      setTimeout(() => {
        setShowImportModal(false);
        setImportUrl('');
        setImportSuccess(null);
      }, 2000);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      if (csvContent) {
        const count = await importFromCSV(csvContent, 'imdb-ratings');
        if (count > 0) {
          setImportSuccess(count);
          setTimeout(() => {
            setShowImportModal(false);
            setImportSuccess(null);
            setImportMode('url');
          }, 2000);
        }
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getImportTypeLabel = () => {
    switch (detectedType) {
      case 'letterboxd':
        return { text: 'Letterboxd Diary detected', color: 'text-[#ff8000]', valid: true };
      case 'imdb-ratings':
        return { text: 'IMDB Ratings detected', color: 'text-yellow-400', valid: true };
      case 'imdb-watchlist':
        return { text: 'IMDB Watchlist detected (go to Watchlist screen)', color: 'text-blue-400', valid: false };
      default:
        return { text: '', color: '', valid: false };
    }
  };

  const isValidImport = () => {
    return detectedType === 'letterboxd' || detectedType === 'imdb-ratings';
  };

  const getImportButtonColor = () => {
    if (detectedType === 'letterboxd') return 'bg-[#ff8000] hover:bg-[#e67300]';
    if (detectedType === 'imdb-ratings') return 'bg-yellow-500 hover:bg-yellow-400';
    return 'bg-gray-600';
  };

  const typeLabel = getImportTypeLabel();

  return (
    <div className="min-h-screen bg-base font-display text-fg flex flex-col max-w-md mx-auto overflow-hidden border-x border-line">
      <LibraryHub />
      {/* Header */}
      <div id="timeline" className="bg-base px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-line">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="p-2 min-h-11 min-w-11 text-fg-2 hover:text-fg"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Watched</h1>
            <p className="text-xs text-gray-500">{watchedEvents.length} films logged</p>
          </div>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-3 min-h-11 bg-base-3 text-fg border border-line text-sm font-medium"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Import</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 flex gap-2 border-b border-gray-800">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-white text-black'
              : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
          }`}
        >
          All ({watchedEvents.length})
        </button>
        <button
          onClick={() => setFilter('liked')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            filter === 'liked'
              ? 'bg-green-500 text-white'
              : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
          }`}
        >
          <ThumbsUp size={14} />
          {likedCount}
        </button>
        <button
          onClick={() => setFilter('disliked')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            filter === 'disliked'
              ? 'bg-red-500 text-white'
              : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
          }`}
        >
          <ThumbsDown size={14} />
          {dislikedCount}
        </button>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto">
        {eventsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Skeleton className="w-24 h-8" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-4">
              <Film className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              {filter === 'all' ? 'No watched movies yet' : `No ${filter} movies`}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              {filter === 'all'
                ? 'Log movies from the calendar and they\'ll appear here as a timeline.'
                : `You haven't ${filter === 'liked' ? 'liked' : 'disliked'} any movies yet.`}
            </p>
          </div>
        ) : (
          <div className="pb-8">
            {timeline.map((monthGroup) => (
              <div key={monthGroup.monthKey}>
                {/* Month Header - sticky */}
                <div className="sticky top-0 z-[5] bg-[#09090b]/95 backdrop-blur-sm px-4 py-3 border-b border-gray-800/50">
                  <h2 className="text-lg font-bold text-white">{monthGroup.monthLabel}</h2>
                </div>

                {monthGroup.weeks.map((weekGroup) => (
                  <div key={weekGroup.weekStart.toISOString()} className="px-4 pt-3 pb-1">
                    {/* Week Sub-header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={13} className="text-gray-500" />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {weekGroup.weekLabel}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        ({weekGroup.movies.length})
                      </span>
                    </div>

                    {/* Movie Poster Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {weekGroup.movies.map((movie) => (
                        <div
                          key={movie.id}
                          onClick={() => navigate(`/movie/${movie.movieId}?type=${movie.mediaType || 'movie'}`)}
                          className="relative rounded-lg overflow-hidden bg-gray-900 group cursor-pointer transform transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-xl active:scale-95"
                        >
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-full aspect-[2/3] object-cover transition-transform duration-200 group-hover:brightness-110"
                            loading="lazy"
                          />
                          
                          {/* Rating Badge */}
                          {movie.rating && (
                            <div
                              className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${
                                movie.rating === 'up'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-red-500 text-white'
                              }`}
                            >
                              {movie.rating === 'up' ? (
                                <ThumbsUp size={10} className="fill-current" />
                              ) : (
                                <ThumbsDown size={10} className="fill-current" />
                              )}
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-1.5">
                            <h4 className="text-[10px] font-bold text-white leading-tight truncate">
                              {movie.title}
                            </h4>
                            <p className="text-[8px] text-gray-400">{movie.year}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => !isImporting && setShowImportModal(false)} 
          />
          
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff8000] to-yellow-500 flex items-center justify-center">
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Import Watched Movies</h3>
                  <p className="text-xs text-gray-500">Letterboxd or IMDB Ratings</p>
                </div>
              </div>
              {!isImporting && (
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {importSuccess !== null ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Import Complete!</h4>
                <p className="text-gray-400">{importSuccess} movies imported</p>
              </div>
            ) : isImporting ? (
              <div className="text-center py-6">
                <Loader2 className={`w-10 h-10 animate-spin mx-auto mb-4 ${importMode === 'csv' ? 'text-yellow-400' : detectedType === 'letterboxd' ? 'text-[#ff8000]' : 'text-yellow-400'}`} />
                <h4 className="text-lg font-bold text-white mb-1">Importing...</h4>
                <p className="text-gray-400">
                  {progress.current} of {progress.total} films
                </p>
                {importedCount > 0 && (
                  <p className="text-sm text-green-400 mt-2">{importedCount} new movies added</p>
                )}
              </div>
            ) : (
              <>
                {/* Import Mode Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setImportMode('url')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      importMode === 'url'
                        ? 'bg-white text-black'
                        : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    Paste URL
                  </button>
                  <button
                    onClick={() => setImportMode('csv')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      importMode === 'csv'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    Upload CSV
                  </button>
                </div>

                {importMode === 'url' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Paste your URL
                      </label>
                      <input
                        type="text"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="letterboxd.com/username or imdb.com/user/.../ratings"
                        className="w-full bg-gray-900 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ff8000] transition-all border border-gray-800"
                        autoFocus
                      />
                      {typeLabel.text && (
                        <p className={`text-xs mt-2 ${typeLabel.color}`}>
                          ✓ {typeLabel.text}
                        </p>
                      )}
                    </div>

                    {importError && (
                      <div className="p-3 rounded-xl bg-red-900/30 border border-red-800/50">
                        <p className="text-sm text-red-400">{importError}</p>
                      </div>
                    )}

                    {/* Supported formats */}
                    <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                      <p className="text-xs font-medium text-gray-300 mb-2">Supported formats:</p>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#ff8000]"></span>
                          letterboxd.com/<span className="text-[#ff8000]">username</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                          imdb.com/user/ur.../ratings/
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={handleImport}
                      disabled={!isValidImport()}
                      className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getImportButtonColor()}`}
                    >
                      Import Films
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 border-dashed">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="flex flex-col items-center justify-center cursor-pointer py-6"
                      >
                        <Upload className="w-10 h-10 text-yellow-400 mb-3" />
                        <p className="text-sm font-medium text-white mb-1">Upload IMDB CSV</p>
                        <p className="text-xs text-gray-500">Click to select your ratings.csv file</p>
                      </label>
                    </div>

                    {importError && (
                      <div className="p-3 rounded-xl bg-red-900/30 border border-red-800/50">
                        <p className="text-sm text-red-400">{importError}</p>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                      <p className="text-xs font-medium text-gray-300 mb-2">How to export from IMDB:</p>
                      <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                        <li>Go to your IMDB Ratings page</li>
                        <li>Click the three dots menu (⋮)</li>
                        <li>Select "Export"</li>
                        <li>Upload the downloaded CSV here</li>
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
