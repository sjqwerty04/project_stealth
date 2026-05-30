import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Users, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useInviteLink, type InviteResolution } from '../hooks/useInviteLink';

export default function InviteAcceptScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { resolveInvite, acceptInvite } = useInviteLink();
  const [invite, setInvite] = useState<InviteResolution | null>(null);
  const [resolving, setResolving] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setResolving(true);
    resolveInvite(code)
      .then((r) => {
        if (!r) setError('Invite not found.');
        else if (r.revoked) setError('This invite has been revoked.');
        else setInvite(r);
      })
      .catch(() => setError('Could not load invite.'))
      .finally(() => setResolving(false));
  }, [code, resolveInvite]);

  const handleAccept = async () => {
    if (!code) return;
    if (!user) {
      // Persist invite code so sign-up can auto-whitelist and resume after auth.
      sessionStorage.setItem('pendingInviteCode', code);
      navigate(`/login?next=/invite/${code}`);
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const listId = await acceptInvite(code);
      navigate(`/shared/${listId}`, { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Could not join list.');
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading || resolving) {
    return (
      <div className="min-h-screen bg-[#09090b] text-gray-100 flex items-center justify-center max-w-md mx-auto">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <div className="w-full bg-[#18181b] rounded-2xl border border-gray-800 p-6 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
          {error ? (
            <X className="w-8 h-8 text-red-400" />
          ) : (
            <Users className="w-8 h-8 text-blue-400" />
          )}
        </div>

        {error ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Invite unavailable</h1>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm"
            >
              Open Selects
            </button>
          </>
        ) : invite ? (
          <>
            <p className="text-sm text-gray-400 mb-1">
              {invite.ownerDisplayName} invited you to join
            </p>
            <h1 className="text-2xl font-bold text-white mb-6">"{invite.listName}"</h1>
            <p className="text-xs text-gray-500 mb-6">
              You'll be able to see and add movies in this shared watchlist.
            </p>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-3 rounded-xl font-semibold bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {accepting && <Loader2 size={16} className="animate-spin" />}
              {user ? 'Join list' : 'Sign in to join'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
