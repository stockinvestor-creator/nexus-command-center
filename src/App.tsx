import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import { isSupabaseConfigured, SETUP_SEEN_KEY } from '@/lib/env';
import { safeStorage } from '@/lib/safeStorage';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, FullScreenLoader } from '@/features/auth/RequireAuth';
import { marketData } from '@/services/market';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const SetupWizard = lazy(() => import('@/features/auth/SetupWizard'));
const CommandCenter = lazy(() => import('@/pages/CommandCenter'));
const Markets = lazy(() => import('@/pages/Markets'));
const WatchlistPage = lazy(() => import('@/pages/Watchlist'));
const Catalysts = lazy(() => import('@/pages/Catalysts'));
const WarRoom = lazy(() => import('@/pages/WarRoom'));
const Messages = lazy(() => import('@/pages/Messages'));
const Groups = lazy(() => import('@/pages/Groups'));
const Settings = lazy(() => import('@/pages/Settings'));
const StockDetail = lazy(() => import('@/pages/StockDetail'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** Show the setup wizard on the very first visit when Supabase isn't configured yet. */
function FirstRun({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured && !safeStorage.get<boolean>(SETUP_SEEN_KEY, false)) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    marketData(); // initialise provider + status panel
    return init();
  }, [init]);

  return (
    <Suspense fallback={<FullScreenLoader label="Loading module…" />}>
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route
          path="/login"
          element={
            <FirstRun>
              <LoginPage />
            </FirstRun>
          }
        />
        <Route
          element={
            <FirstRun>
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            </FirstRun>
          }
        >
          <Route index element={<CommandCenter />} />
          <Route path="markets" element={<Markets />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="catalysts" element={<Catalysts />} />
          <Route path="war-room" element={<WarRoom />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:channelId" element={<Messages />} />
          <Route path="groups" element={<Groups />} />
          <Route path="settings" element={<Settings />} />
          <Route path="stock/:symbol" element={<StockDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
