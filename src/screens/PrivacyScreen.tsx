import { Link } from 'react-router-dom';
import { Mark } from '../components/ui';

export default function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-base px-7 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <Mark variant="lockup" size={40} />
        <h1 className="font-display text-2xl text-fg">Privacy</h1>
        <div className="space-y-4 font-spec text-xs leading-relaxed text-fg-2">
          <p>
            Selects is a film journal. When you create an account we store your email, a display
            name, and the movies you log, like, or save.
          </p>
          <p>
            Sign-in uses Firebase Authentication. Journal data lives in Firebase Firestore. We use
            this to run the product, not to sell a list of what you watch.
          </p>
          <p>
            The iOS app does not offer Google sign-in. The website still does. Google then receives
            the data Google publishes for that sign-in.
          </p>
          <p>
            To delete an account or ask what we hold, email shivjethi04@gmail.com from the address
            on the account.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-block font-spec text-[10px] uppercase tracking-widest text-fg-3"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
