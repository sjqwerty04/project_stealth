import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mark, Button, Input } from '../components/ui';

type Step = 'email' | 'choose' | 'signin' | 'signup';

export default function LoginScreen() {
  const { checkWhitelist, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const isSafeNext = !!nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//');
  const goAfterAuth = (isNew = false) => {
    if (isNew) {
      const dest = isSafeNext ? nextPath! : '/app';
      navigate(`/onboarding?next=${encodeURIComponent(dest)}`, { replace: true });
    } else {
      navigate(isSafeNext ? nextPath! : '/app', { replace: true });
    }
  };

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const whitelisted = await checkWhitelist(email);
      const hasInvite =
        !!sessionStorage.getItem('pendingInviteCode') || !!sessionStorage.getItem('appInvite');
      if (whitelisted || hasInvite) {
        setStep('choose');
      } else {
        navigate('/waitlist', { replace: true });
      }
    } catch {
      setError('Unable to verify access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      goAfterAuth();
    } catch (err: any) {
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password. Try again or create a new account.');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUp(email, password);
      goAfterAuth(true);
    } catch (err: any) {
      if (err.message === 'Email not whitelisted') {
        navigate('/waitlist', { replace: true });
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Account already exists. Try signing in instead.');
      } else {
        setError('Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      goAfterAuth();
    } catch (err: any) {
      if (err.message === 'Email not whitelisted') {
        navigate('/waitlist', { replace: true });
      } else {
        setError('Google sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-7">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3">
          <Mark variant="lockup" size={40} />
          <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3">
            The take worth keeping
          </p>
        </div>

        {error && (
          <div className="border border-line p-3 font-spec text-xs text-fg-2" role="alert">
            {error}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleCheckAccess} className="space-y-3" data-testid="login-email">
            <Input
              type="email"
              name="email"
              placeholder="your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              aria-label="your email"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
            <Button type="button" kind="secondary" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
              Continue with Google
            </Button>
          </form>
        )}

        {step === 'choose' && (
          <div className="space-y-3" data-testid="login-choose">
            <p className="font-spec text-[10px] text-fg-3 uppercase tracking-widest">{email}</p>
            <Button className="w-full" onClick={() => { setStep('signup'); setError(''); }}>
              Create New Account
            </Button>
            <Button kind="secondary" className="w-full" onClick={() => { setStep('signin'); setError(''); }}>
              I Already Have an Account
            </Button>
            <Button kind="ghost" className="w-full" onClick={() => { setStep('email'); setError(''); }}>
              Change email
            </Button>
          </div>
        )}

        {step === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3" data-testid="login-signin">
            <Input
              type="password"
              name="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              aria-label="password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
            <Button kind="ghost" className="w-full" onClick={() => setStep('choose')}>
              Back
            </Button>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3" data-testid="login-signup">
            <Input
              type="password"
              name="password"
              placeholder="password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              aria-label="password"
            />
            <Input
              type="password"
              name="confirm"
              placeholder="confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              aria-label="confirm password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
            <Button kind="ghost" className="w-full" onClick={() => setStep('choose')}>
              Back
            </Button>
          </form>
        )}
      </div>
      <p className="absolute bottom-8 font-spec text-[10px] uppercase tracking-widest text-fg-3">
        Invite only. For now.
      </p>
    </div>
  );
}
