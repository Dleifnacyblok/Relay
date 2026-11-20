import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import IEPDashboard from '@/pages/IEPDashboard';
import Demo from '@/pages/Demo';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();
  const isDemoPath = location.pathname === '/demo' || location.pathname.startsWith('/demo/');

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // A registered, signed-in team member gets the full app (unless viewing the public demo link)
  const canUseApp = isAuthenticated && authError?.type !== 'user_not_registered';
  if (canUseApp && !isDemoPath) {
    return (
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="/IEPDashboard" element={
          <LayoutWrapper currentPageName="IEPDashboard">
            <IEPDashboard />
          </LayoutWrapper>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    );
  }

  // Everyone else — anonymous visitors and the shared demo link — sees the read-only demo, no login required
  return (
    <Routes>
      <Route path="/demo" element={<Demo />} />
      <Route path="/demo/*" element={<Demo />} />
      <Route path="*" element={<Demo />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App