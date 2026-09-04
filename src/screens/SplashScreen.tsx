import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mark, Skeleton } from '../components/ui';

export default function SplashScreen() {
  const { user, loading, isWhitelisted } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
    } else if (isWhitelisted === false) {
      navigate('/waitlist', { replace: true });
    } else if (isWhitelisted === true) {
      navigate('/app', { replace: true });
    }
  }, [user, loading, isWhitelisted, navigate]);

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-7">
      <Mark variant="lockup" size={48} />
      <p className="mt-6 max-w-sm text-center font-display text-lg text-fg leading-snug">
        Selects reads you, and hands you the take worth keeping.
      </p>
      <Skeleton className="mt-10 h-2 w-24" />
      <p className="absolute bottom-8 font-spec text-[10px] uppercase tracking-widest text-fg-3">
        The take worth keeping
      </p>
    </div>
  );
}
