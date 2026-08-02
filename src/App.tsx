import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExplorationProvider } from './contexts/ExplorationContext';
import ProtectedRoute from './components/ProtectedRoute';
import ClaimHandleBanner from './components/ClaimHandleBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import RouteFallback from './components/RouteFallback';

// Eager: everything on the path to a first decision. Splitting these would trade
// a network round trip for bundle size on the one journey we optimise for.
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import MovieCalendarApp from './prototype/MovieCalendarApp';
import FeedbackFAB from './components/FeedbackFAB';

// Lazy: reachable, but not on the decision path.
const WaitlistScreen = lazy(() => import('./screens/WaitlistScreen'));
const WatchedScreen = lazy(() => import('./screens/WatchedScreen'));
const WatchlistScreen = lazy(() => import('./screens/WatchlistScreen'));
const CleanupIMDBCalendar = lazy(() => import('./components/CleanupIMDBCalendar'));
const DiscoverScreen = lazy(() => import('./screens/DiscoverScreen'));
const MovieDetailScreen = lazy(() => import('./screens/MovieDetailScreen'));
const SavedVibesScreen = lazy(() => import('./screens/SavedVibesScreen'));
const OrbitScreen = lazy(() => import('./screens/OrbitScreen'));
const DNAScreen = lazy(() => import('./screens/DNAScreen'));
const SharedWatchlistsScreen = lazy(() => import('./screens/SharedWatchlistsScreen'));
const SharedWatchlistDetailScreen = lazy(() => import('./screens/SharedWatchlistDetailScreen'));
const InviteAcceptScreen = lazy(() => import('./screens/InviteAcceptScreen'));
const LikedMoviesScreen = lazy(() => import('./screens/LikedMoviesScreen'));
const SavedScreen = lazy(() => import('./screens/SavedScreen'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen'));
const TonightScreen = lazy(() => import('./screens/TonightScreen'));
const AdminScreen = lazy(() => import('./screens/AdminScreen'));
const JoinScreen = lazy(() => import('./screens/JoinScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExplorationProvider>
          <ClaimHandleBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/waitlist" element={<WaitlistScreen />} />
              <Route path="/invite/:code" element={<InviteAcceptScreen />} />
              <Route path="/join" element={<JoinScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <MovieCalendarApp />
                    <FeedbackFAB />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/watched"
                element={
                  <ProtectedRoute>
                    <WatchedScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/watchlist"
                element={
                  <ProtectedRoute>
                    <WatchlistScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shared"
                element={
                  <ProtectedRoute>
                    <SharedWatchlistsScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/liked"
                element={
                  <ProtectedRoute>
                    <LikedMoviesScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/saved"
                element={
                  <ProtectedRoute>
                    <SavedScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shared/:listId"
                element={
                  <ProtectedRoute>
                    <SharedWatchlistDetailScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cleanup"
                element={
                  <ProtectedRoute>
                    <CleanupIMDBCalendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tonight"
                element={
                  <ProtectedRoute>
                    <TonightScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/discover"
                element={
                  <ProtectedRoute>
                    <DiscoverScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/movie/:id"
                element={
                  <ProtectedRoute>
                    <MovieDetailScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vibes"
                element={
                  <ProtectedRoute>
                    <SavedVibesScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orbit/:id"
                element={
                  <ProtectedRoute>
                    <OrbitScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dna/:id"
                element={
                  <ProtectedRoute>
                    <DNAScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/me"
                element={
                  <ProtectedRoute>
                    <ProfileScreen />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <PWAUpdatePrompt />
        </ExplorationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
