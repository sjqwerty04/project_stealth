import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mark, Button } from '../components/ui';

export default function WaitlistScreen() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = async () => {
    if (user) {
      await signOut();
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-sm space-y-8">
        <Mark variant="lockup" size={40} />
        <div className="space-y-3">
          <h1 className="font-display text-2xl text-fg">Invite only. For now.</h1>
          <p className="text-fg-2 leading-relaxed">
            Selects is carefully curating its beta. Ask for an invite, or try a different email.
          </p>
        </div>
        {user?.email && (
          <p className="font-spec text-xs text-fg-3 border border-line p-3">{user.email}</p>
        )}
        <Button kind="secondary" className="w-full" onClick={handleGoBack}>
          Try a Different Email
        </Button>
      </div>
    </div>
  );
}
