import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from '../components/ui';

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
    <div className="min-h-screen bg-base flex items-center justify-center">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}
