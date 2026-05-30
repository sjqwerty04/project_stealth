import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle, Loader2, Mail, RefreshCw } from 'lucide-react';

export default function EmailVerificationScreen() {
  const { user, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);

  const resend = async () => {
    if (!auth.currentUser) return;
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } finally {
      setResending(false);
    }
  };

  const checkVerified = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    await auth.currentUser.reload();
    // ProtectedRoute will re-evaluate automatically via onAuthStateChanged.
    // If still not verified, just stop the spinner.
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Mail className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Check your email</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            We sent a verification link to<br />
            <span className="text-white font-medium">{user?.email}</span>
          </p>
          <p className="text-xs text-gray-600">
            Click the link in that email to activate your account. Check your spam folder if you don't see it.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={checkVerified}
            disabled={checking}
            className="w-full bg-white hover:bg-gray-200 text-black font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            I've verified my email
          </button>

          <button
            onClick={resend}
            disabled={resending || resent}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-medium py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {resending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            {resent ? 'Email sent!' : 'Resend email'}
          </button>
        </div>

        <button
          onClick={signOut}
          className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
