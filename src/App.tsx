import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExplorationProvider } from './contexts/ExplorationContext';
import ProtectedRoute from './components/ProtectedRoute';
import FeedbackFAB from './components/FeedbackFAB';
import ClaimHandleBanner from './components/ClaimHandleBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import WaitlistScreen from './screens/WaitlistScreen';
import WatchedScreen from './screens/WatchedScreen';
import WatchlistScreen from './screens/WatchlistScreen';
import MovieCalendarApp from './prototype/MovieCalendarApp';
import CleanupIMDBCalendar from './components/CleanupIMDBCalendar';
import DiscoverScreen from './screens/DiscoverScreen';
import MovieDetailScreen from './screens/MovieDetailScreen';
import SavedVibesScreen from './screens/SavedVibesScreen';
import OrbitScreen from './screens/OrbitScreen';
import DNAScreen from './screens/DNAScreen';
import SharedWatchlistsScreen from './screens/SharedWatchlistsScreen';
import SharedWatchlistDetailScreen from './screens/SharedWatchlistDetailScreen';
import InviteAcceptScreen from './screens/InviteAcceptScreen';
import LikedMoviesScreen from './screens/LikedMoviesScreen';
import SavedScreen from './screens/SavedScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AdminScreen from './screens/AdminScreen';
import JoinScreen from './screens/JoinScreen';
import ProfileScreen from './screens/ProfileScreen';
import AppShell from './components/AppShell';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExplorationProvider>
          <ClaimHandleBanner />
          <AppShell>
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
          </AppShell>
          <PWAUpdatePrompt />
        </ExplorationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
