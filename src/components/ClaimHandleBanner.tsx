import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AtSign, Check, Loader2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useHandle, normalizeHandle, isValidHandle } from '../hooks/useHandle';

const SESSION_DISMISS_KEY = 'selects.claimHandleBanner.dismissed';

const HIDDEN_PATH_PREFIXES = ['/login', '/waitlist', '/invite', '/'];

export default function ClaimHandleBanner() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const { claimHandle, isAvailable } = useHandle();
  const location = useLocation();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(
    'idle'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lower = useMemo(() => normalizeHandle(value), [value]);

  useEffect(() => {
    if (!value) {
      setStatus('idle');
      return;
    }
    if (!isValidHandle(lower)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const ok = await isAvailable(lower);
        if (!cancelled) setStatus(ok ? 'available' : 'taken');
      } catch {
        if (!cancelled) setStatus('idle');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [lower, value, isAvailable]);

  const isHiddenRoute =
    location.pathname === '/' ||
    HIDDEN_PATH_PREFIXES.some(
      (p) => p !== '/' && location.pathname.startsWith(p)
    );

  if (!user || loading || dismissed || isHiddenRoute) return null;
  if (profile?.handle) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  const submit = async () => {
    if (status !== 'available') return;
    setSubmitting(true);
    setError(null);
    try {
      await claimHandle(lower);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Could not claim handle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="sticky top-0 z-40 bg-blue-600/90 backdrop-blur-md text-white text-sm border-b border-blue-500/40"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-md mx-auto px-4 py-2 flex items-center gap-3">
          <AtSign size={16} className="shrink-0" />
          <span className="flex-1 leading-snug">
            Pick a handle so friends can find you.
          </span>
          <button
            onClick={() => setOpen(true)}
            className="px-3 py-1.5 bg-white text-blue-700 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors"
          >
            Claim
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-1 text-white/80 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="bg-[#18181b] w-full max-w-sm rounded-2xl p-6 shadow-2xl z-50 relative border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-lg">Claim your handle</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              3-20 characters. Lowercase letters, numbers, underscore.
            </p>

            <div className="flex items-center bg-black/40 border border-gray-800 rounded-xl px-3 py-3 mb-2">
              <span className="text-gray-500 mr-1">@</span>
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="your_handle"
                className="flex-1 bg-transparent outline-none text-white placeholder-gray-600"
              />
              {status === 'checking' && <Loader2 size={16} className="text-gray-500 animate-spin" />}
              {status === 'available' && <Check size={16} className="text-green-400" />}
            </div>

            {status === 'taken' && (
              <p className="text-xs text-red-400 mb-2">Handle already taken.</p>
            )}
            {status === 'invalid' && value.length > 0 && (
              <p className="text-xs text-amber-400 mb-2">
                Use 3-20 chars: lowercase letters, numbers, underscore.
              </p>
            )}
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

            <button
              onClick={submit}
              disabled={status !== 'available' || submitting}
              className="w-full mt-2 py-3 rounded-xl font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Claim @{lower || '...'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
