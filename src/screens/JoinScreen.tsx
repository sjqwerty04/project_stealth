import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function JoinScreen() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? '/app' : '/login'} replace />;
}
