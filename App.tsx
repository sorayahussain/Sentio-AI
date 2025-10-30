import React, { useState, useCallback, useMemo, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import PermissionsPage from './pages/PermissionsPage';
import InterviewPage from './pages/InterviewPage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage'; // Import SettingsPage
import { Page, InterviewType, InterviewResult } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import Loader from './components/Loader';

export const AppContext = React.createContext<{
  navigateTo: (page: Page, interviewType?: InterviewType) => void;
  showReport: (result: InterviewResult) => void;
  interviewType: InterviewType;
  user: User | null;
  logout: () => void;
}>({
  navigateTo: () => {},
  showReport: () => {},
  interviewType: 'Job',
  user: null,
  logout: () => {},
});

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [interviewType, setInterviewType] = useState<InterviewType>('Job');
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && (currentPage === 'auth' || currentPage === 'landing')) {
          setCurrentPage('permissions');
      } else if (!currentUser && (currentPage !== 'landing' && currentPage !== 'auth')) {
          setCurrentPage('auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentPage('landing');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  const navigateTo = useCallback((page: Page, type?: InterviewType) => {
    // Reset report when navigating away from it
    if(currentPage === 'report') setInterviewResult(null);
    
    setCurrentPage(page);
    if (type) {
      setInterviewType(type);
    }
  }, [currentPage]);

  const showReport = useCallback((result: InterviewResult) => {
    setInterviewResult(result);
    setCurrentPage('report');
  }, []);
  
  const contextValue = useMemo(() => ({ navigateTo, showReport, interviewType, user, logout }), [navigateTo, showReport, interviewType, user, logout]);

  const renderPage = () => {
    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader text="Initializing..."/></div>
    }

    // Protected Routes Logic
    if (!user) {
        if(currentPage === 'landing') return <LandingPage />;
        return <AuthPage />;
    }

    switch (currentPage) {
      case 'permissions':
        return <PermissionsPage />;
      case 'interview':
        return <InterviewPage />;
      case 'report':
        return interviewResult ? <ReportPage result={interviewResult} /> : <InterviewPage />;
      case 'history':
        return <HistoryPage />;
      case 'settings': // Add settings page route
        return <SettingsPage />;
      case 'auth': // Should not be reached if user is logged in, but as a fallback
        return <PermissionsPage />;
      case 'landing':
      default:
        return <LandingPage />;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="bg-gray-900 min-h-screen text-white font-sans">
        {renderPage()}
      </div>
    </AppContext.Provider>
  );
};

export default App;