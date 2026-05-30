import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { AtSign, Check, Copy, Link2, Loader2, Search, Share2, UserPlus, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { useInviteLink } from '../hooks/useInviteLink';
import { useHandle, type HandleSearchResult } from '../hooks/useHandle';
import type { SharedWatchlist } from '../hooks/useSharedWatchlists';

type Tab = 'search' | 'link';

type Props = {
  list: SharedWatchlist;
  open: boolean;
  onClose: () => void;
};

export default function InviteShareModal({ list, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('search');
  const { createInvite } = useInviteLink();
  const { searchHandles } = useHandle();

  // — Link tab state —
  const [url, setUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // — Search tab state —
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HandleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedUids, setAddedUids] = useState<Set<string>>(new Set());
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setTab('search');
      setQuery('');
      setResults([]);
      setUrl(null);
      setCopied(false);
      setLinkError(null);
      setAddError(null);
      setAddedUids(new Set());
    } else {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  // Debounced handle search
  useEffect(() => {
    if (!open || tab !== 'search') return;
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchHandles(query);
        if (!cancelled) {
          // Filter out users already in the list
          const existing = new Set(list.memberUids ?? []);
          setResults(res.filter((r) => !existing.has(r.uid)));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open, tab, searchHandles, list.memberUids]);

  // Lazy-load the invite link only when the link tab is opened
  const loadLink = useCallback(async () => {
    if (url) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      const res = await createInvite(list.id, list.name);
      setUrl(res.url);
    } catch (e: any) {
      setLinkError(e?.message ?? 'Could not create link');
    } finally {
      setLinkLoading(false);
    }
  }, [url, createInvite, list.id, list.name]);

  useEffect(() => {
    if (open && tab === 'link') loadLink();
  }, [open, tab, loadLink]);

  const addByHandle = async (result: HandleSearchResult) => {
    setAddingUid(result.uid);
    setAddError(null);
    try {
      await updateDoc(doc(db, 'shared_watchlists', list.id), {
        memberUids: arrayUnion(result.uid),
        [`members.${result.uid}`]: {
          handle: result.handle,
          displayName: result.displayName,
          profileImage: result.profileImage,
          joinedAt: new Date(),
        },
        updatedAt: serverTimestamp(),
      });
      setAddedUids((s) => new Set(s).add(result.uid));
    } catch (e: any) {
      setAddError(e?.message ?? 'Could not add user');
    } finally {
      setAddingUid(null);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { setLinkError('Copy failed'); }
  };

  const share = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join "${list.name}" on Selects`,
          text: `Add movies with me to "${list.name}"`,
          url,
        });
      } else {
        await copy();
      }
    } catch { /* dismissed */ }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[#18181b] rounded-t-3xl sm:rounded-2xl border-t border-x sm:border border-gray-800 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white text-lg leading-tight">Invite to "{list.name}"</h3>
            <p className="text-xs text-gray-500 mt-0.5">Add people to this shared list</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 mb-4">
          <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
            <TabBtn active={tab === 'search'} onClick={() => setTab('search')} icon={<AtSign size={14} />} label="Search users" />
            <TabBtn active={tab === 'link'} onClick={() => setTab('link')} icon={<Link2 size={14} />} label="Invite link" />
          </div>
        </div>

        {/* — SEARCH TAB — */}
        {tab === 'search' && (
          <div className="px-5 pb-2">
            <div className="flex items-center bg-black/40 border border-gray-800 rounded-xl px-3 py-2.5 mb-4 focus-within:border-blue-500 transition-colors">
              <Search size={16} className="text-gray-500 mr-2 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by @handle…"
                className="flex-1 bg-transparent outline-none text-white text-sm placeholder-gray-600"
              />
              {searching && <Loader2 size={14} className="text-gray-500 animate-spin shrink-0" />}
              {query && !searching && (
                <button onClick={() => { setQuery(''); setResults([]); }} className="text-gray-600 hover:text-gray-400">
                  <X size={14} />
                </button>
              )}
            </div>

            {addError && (
              <p className="text-xs text-red-400 mb-3">{addError}</p>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {query.length < 2 && (
                <p className="text-xs text-gray-600 text-center py-4">Type at least 2 characters to search</p>
              )}
              {query.length >= 2 && !searching && results.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">No users found for "@{query}"</p>
              )}
              {results.map((r) => {
                const isAdded = addedUids.has(r.uid);
                const isAdding = addingUid === r.uid;
                return (
                  <div key={r.uid} className="flex items-center gap-3 bg-black/30 rounded-xl px-3 py-2.5 border border-gray-800">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-sm font-semibold shrink-0">
                      {r.profileImage
                        ? <img src={r.profileImage} alt={r.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : r.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.displayName}</p>
                      <p className="text-xs text-gray-500">@{r.handle}</p>
                    </div>
                    <button
                      onClick={() => !isAdded && !isAdding && addByHandle(r)}
                      disabled={isAdded || isAdding}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isAdded
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
                      }`}
                    >
                      {isAdding ? <Loader2 size={12} className="animate-spin" /> :
                       isAdded ? <Check size={12} /> : <UserPlus size={12} />}
                      {isAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Fallback to link */}
            <button
              onClick={() => setTab('link')}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700 text-sm transition-colors"
            >
              <Link2 size={14} />
              They don't have Selects yet? Send an invite link
            </button>
          </div>
        )}

        {/* — LINK TAB — */}
        {tab === 'link' && (
          <div className="px-5 pb-2">
            <p className="text-xs text-gray-500 mb-4">
              Anyone with this link can join the list and start adding movies.
            </p>

            {linkLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}

            {linkError && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-3">
                {linkError}
              </div>
            )}

            {url && (
              <>
                <div className="bg-black/40 border border-gray-800 rounded-xl px-3 py-3 text-sm text-gray-400 break-all mb-4 font-mono select-all">
                  {url}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copy}
                    className="py-3 rounded-xl font-medium bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    onClick={share}
                    className="py-3 rounded-xl font-medium bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-colors"
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
