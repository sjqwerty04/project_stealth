import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Skeleton from './ui/Skeleton';
type ProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isWhitelisted } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <Skeleton className="w-24 h-8" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isWhitelisted === false) return <Navigate to="/waitlist" replace />;

  return <>{children}</>;
}
