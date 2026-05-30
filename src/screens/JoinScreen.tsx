import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Landing page for general "invite to Selects" links.
// Sets a session flag so the login screen bypasses the whitelist gate.
export default function JoinScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    sessionStorage.setItem('appInvite', '1');
    if (user) {
      navigate('/app', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
    </div>
  );
}
