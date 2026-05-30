import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, ChevronRight, Heart, ListPlus, Loader2, Plus, Upload, Users, X } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useSharedWatchlists } from '../hooks/useSharedWatchlists';
import { useIMDBImport, detectImportType } from '../hooks/useIMDBImport';

export default function WatchlistScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { items: savedItems, loading: savedLoading, refreshWatchlist } = useWatchlist();
  const { personalLists, sharedLists, loading: listsLoading, createList } = useSharedWatchlists();
  const { importFromIMDB, importFromCSV, isImporting, progress, error: importError } = useIMDBImport();

  const [showCreatePersonal, setShowCreatePersonal] = useState(false);
  const [showCreateShared, setShowCreateShared] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const loading = savedLoading || listsLoading;

  const handleCreate = async (isPersonal: boolean) => {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    const id = await createList(name, { isPersonal });
    setCreating(false);
    setNewListName('');
    setShowCreatePersonal(false);
    setShowCreateShared(false);
    if (id) navigate(isPersonal ? `/shared/${id}` : `/shared/${id}`);
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    const type = detectImportType(importUrl);
    if (type !== 'imdb-watchlist') return;
    const count = await importFromIMDB(importUrl, 'imdb-watchlist');
    if (count > 0) {
      setImportSuccess(count);
      await refreshWatchlist();
      setTimeout(() => { setShowImportModal(false); setImportUrl(''); setImportSuccess(null); }, 2000);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target?.result as string;
      if (csv) {
        const count = await importFromCSV(csv, 'imdb-watchlist');
        if (count > 0) {
          setImportSuccess(count);
          await refreshWatchlist();
          setTimeout(() => { setShowImportModal(false); setImportSuccess(null); }, 2000);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-gray-100 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-800">
      {/* Header */}
      <div className="bg-[#09090b]/90 backdrop-blur-md px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Library</h1>
            <p className="text-xs text-gray-500">Your lists &amp; saved films</p>
          </div>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
        >
          <Upload size={15} />
          Import
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Liked + Saved */}
            <section>
              <LibraryRow
                icon={<Heart size={18} className="text-red-400 fill-current" />}
                label="Liked Movies"
                subtitle="Films you gave a thumbs up"
                accentColor="bg-red-500/10"
                onTap={() => navigate('/liked')}
              />
              <LibraryRow
                icon={<Bookmark size={18} className="text-blue-400 fill-current" />}
                label="Saved"
                subtitle={`${savedItems.length} film${savedItems.length !== 1 ? 's' : ''}`}
                accentColor="bg-blue-500/10"
                onTap={() => navigate('/saved')}
              />
            </section>

            {/* My Playlists */}
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">My Playlists</p>
                <button
                  onClick={() => { setShowCreatePersonal(true); setShowCreateShared(false); }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus size={14} />
                  New
                </button>
              </div>

              {showCreatePersonal && (
                <CreateListInput
                  value={newListName}
                  onChange={setNewListName}
                  onSubmit={() => handleCreate(true)}
                  onCancel={() => { setShowCreatePersonal(false); setNewListName(''); }}
                  creating={creating}
                  placeholder="Playlist name…"
                />
              )}

              {personalLists.length === 0 && !showCreatePersonal ? (
                <button
                  onClick={() => { setShowCreatePersonal(true); setShowCreateShared(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-700 transition-colors text-sm"
                >
                  <ListPlus size={16} />
                  Create a playlist
                </button>
              ) : (
                personalLists.map((list) => (
                  <LibraryRow
                    key={list.id}
                    icon={<ListPlus size={18} className="text-purple-400" />}
                    label={list.name}
                    subtitle="Personal playlist"
                    accentColor="bg-purple-500/10"
                    onTap={() => navigate(`/shared/${list.id}`)}
                  />
                ))
              )}
            </section>

            {/* Shared Lists */}
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shared with Friends</p>
                <button
                  onClick={() => { setShowCreateShared(true); setShowCreatePersonal(false); }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus size={14} />
                  New
                </button>
              </div>

              {showCreateShared && (
                <CreateListInput
                  value={newListName}
                  onChange={setNewListName}
                  onSubmit={() => handleCreate(false)}
                  onCancel={() => { setShowCreateShared(false); setNewListName(''); }}
                  creating={creating}
                  placeholder="e.g. Date Night, Horror Club…"
                />
              )}

              {sharedLists.length === 0 && !showCreateShared ? (
                <button
                  onClick={() => { setShowCreateShared(true); setShowCreatePersonal(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-700 transition-colors text-sm"
                >
                  <Users size={16} />
                  Create a shared list with a friend
                </button>
              ) : (
                sharedLists.map((list) => {
                  const memberCount = list.memberUids?.length ?? 0;
                  const avatars = Object.values(list.members ?? {}).slice(0, 3);
                  return (
                    <LibraryRow
                      key={list.id}
                      icon={
                        <div className="flex -space-x-2">
                          {avatars.map((m, i) => (
                            <div key={i} className="w-7 h-7 rounded-full ring-2 ring-[#09090b] overflow-hidden bg-gray-700 flex items-center justify-center text-xs font-semibold">
                              {m.profileImage
                                ? <img src={m.profileImage} alt={m.displayName} className="w-full h-full object-cover" />
                                : (m.displayName || '?').charAt(0)}
                            </div>
                          ))}
                        </div>
                      }
                      label={list.name}
                      subtitle={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
                      accentColor="bg-green-500/10"
                      onTap={() => navigate(`/shared/${list.id}`)}
                    />
                  );
                })
              )}
            </section>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isImporting && setShowImportModal(false)} />
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Import from IMDB</h3>
              {!isImporting && (
                <button onClick={() => setShowImportModal(false)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800">
                  <X size={16} />
                </button>
              )}
            </div>

            {importSuccess ? (
              <p className="text-green-400 text-center py-4">✓ Imported {importSuccess} movies</p>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Upload size={16} />
                  Upload IMDB CSV
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-[#18181b] px-4 text-gray-500">or paste URL</span></div>
                </div>
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://www.imdb.com/list/..."
                  className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-blue-500 placeholder-gray-600"
                />
                {isImporting && (
                  <div className="text-center text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                    Importing {progress.current}/{progress.total}...
                  </div>
                )}
                {importError && <p className="text-xs text-red-400">{importError}</p>}
                <button
                  onClick={handleImport}
                  disabled={!importUrl.trim() || isImporting || detectImportType(importUrl) !== 'imdb-watchlist'}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Import
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  icon,
  label,
  subtitle,
  accentColor,
  onTap,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  accentColor: string;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60 rounded-2xl p-3 transition-colors text-left mb-2"
    >
      <div className={`w-11 h-11 rounded-xl ${accentColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-gray-600 shrink-0" />
    </button>
  );
}

function CreateListInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  creating,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  creating: boolean;
  placeholder: string;
}) {
  return (
    <div className="bg-black/30 rounded-2xl border border-gray-800 p-3 mb-2 space-y-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-white placeholder-gray-600 text-sm"
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white">Cancel</button>
        <button
          onClick={onSubmit}
          disabled={!value.trim() || creating}
          className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"
        >
          {creating && <Loader2 size={14} className="animate-spin" />}
          Create
        </button>
      </div>
    </div>
  );
}
