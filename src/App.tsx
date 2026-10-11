import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { MyQuizzesView } from './views/MyQuizzesView.tsx';
import { CreateQuizView } from './views/CreateQuizView.tsx';
import { CbtExamView } from './views/CbtExamView.tsx';
import { LearningHubView } from './views/LearningHubView.tsx';
import { BrowseHubView } from './views/BrowseHubView.tsx';
import { AnalyticsView } from './views/AnalyticsView.tsx';
import { CommunityView } from './views/CommunityView.tsx';
import { ProfileView } from './views/ProfileView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { AdminView } from './views/AdminView.tsx';
import { LeaderboardModal } from './views/LeaderboardModal.tsx';
import { AuthModal } from './views/AuthModal.tsx';
import { TakeQuizModal } from './components/TakeQuizModal.tsx';
import { RegisterForQuizView } from './views/RegisterForQuizView.tsx';

function MainApp() {
  const { user, isLoading: authLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [activeQuizForCbt, setActiveQuizForCbt] = useState<string | null>(null);
  const [editQuizId, setEditQuizId] = useState<string | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [takeQuizModalOpen, setTakeQuizModalOpen] = useState<boolean>(false);
  const [registerQuizCode, setRegisterQuizCode] = useState<string | null>(null);
  const [standaloneLeaderboardQuiz, setStandaloneLeaderboardQuiz] = useState<{ id: string; title: string } | null>(null);

  // Check URL params on initial load for shareable link (e.g. ?quiz=REM-UTME-400)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quizCode = params.get('quiz');
    const regCode = params.get('register');
    if (regCode) {
      setRegisterQuizCode(regCode);
    }
    if (quizCode) {
      setActiveQuizForCbt(quizCode);
    }
  }, []);

  const handleNavigate = (tab: string, meta?: any) => {
    if (meta?.editQuizId) {
      setEditQuizId(meta.editQuizId);
    } else {
      setEditQuizId(undefined);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartQuiz = (codeOrId: string) => {
    setActiveQuizForCbt(codeOrId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExitCbt = () => {
    setActiveQuizForCbt(null);
    // Remove query param cleanly
    const url = new URL(window.location.href);
    url.searchParams.delete('quiz');
    window.history.replaceState({}, '', url.pathname);
    setCurrentTab('dashboard');
  };

  // If currently taking a CBT exam, render distraction-free examination stage
  // Visitors (logged out) can only see the public quiz list
  useEffect(() => {
    if (!authLoading && !user && currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
    }
  }, [authLoading, user, currentTab]);

  if (registerQuizCode) {
    return (
      <RegisterForQuizView
        quizCode={registerQuizCode}
        onClose={() => {
          setRegisterQuizCode(null);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (activeQuizForCbt) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <header className="h-14 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              R
            </div>
            <div>
              <span className="font-bold text-sm text-white">Remedi Pro CBT</span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-2">
                Secure Proctoring Mode
              </span>
            </div>
          </div>

        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <CbtExamView
            quizIdOrCode={activeQuizForCbt}
            onExit={handleExitCbt}
            onViewLeaderboard={(qId) => {
              setStandaloneLeaderboardQuiz({ id: qId, title: 'Exam Leaderboard' });
            }}
          />
        </main>

        {standaloneLeaderboardQuiz && (
          <LeaderboardModal
            quizId={standaloneLeaderboardQuiz.id}
            quizTitle={standaloneLeaderboardQuiz.title}
            isCreatorOrAdmin={user?.role === 'creator' || user?.role === 'admin'}
            onClose={() => setStandaloneLeaderboardQuiz(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenTakeQuizModal={() => setTakeQuizModalOpen(true)}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        mobileSidebarOpen={mobileSidebarOpen}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Desktop Sidebar & Mobile drawer */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleNavigate}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
        />

        {/* Content Viewport */}
        <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onTakeQuiz={handleStartQuiz}
              onOpenAuthModal={() => setAuthModalOpen(true)}
            />
          )}

          {currentTab === 'my-quizzes' && (
            <MyQuizzesView
              onNavigate={handleNavigate}
              onTakeQuiz={handleStartQuiz}
            />
          )}

          {currentTab === 'create-quiz' && !(user?.role === 'creator' || user?.role === 'admin') && (
            <div className="max-w-md mx-auto mt-10 bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-xs">
              <h2 className="text-base font-bold text-slate-900">Create an account to make quizzes</h2>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {user
                  ? 'Your account is a student account. Sign up with a creator account to create quizzes.'
                  : 'You can attempt quizzes without an account, but you need a creator account to create one.'}
              </p>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="mt-4 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl"
              >
                {user ? 'Sign in with another account' : 'Create account / Log in'}
              </button>
            </div>
          )}

          {currentTab === 'create-quiz' && (user?.role === 'creator' || user?.role === 'admin') && (
            <CreateQuizView
              editQuizId={editQuizId}
              onNavigate={handleNavigate}
              onQuizSaved={(saved) => {
                handleNavigate('my-quizzes');
              }}
            />
          )}

          {currentTab === 'learning-hub' && (
            <LearningHubView
              onNavigate={handleNavigate}
              onTakeQuiz={handleStartQuiz}
            />
          )}

          {currentTab === 'browse-hub' && (
            <BrowseHubView onNavigate={handleNavigate} />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView onTakeQuiz={handleStartQuiz} />
          )}

          {currentTab === 'community' && <CommunityView />}

          {currentTab === 'profile' && (
            <ProfileView onNavigate={handleNavigate} />
          )}

          {currentTab === 'settings' && <SettingsView />}

          {currentTab === 'admin' && (
            <AdminView onNavigate={handleNavigate} />
          )}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Take Quiz Modal */}
      <TakeQuizModal
        isOpen={takeQuizModalOpen}
        onClose={() => setTakeQuizModalOpen(false)}
        onEnterQuiz={handleStartQuiz}
      />

      {/* Standalone Leaderboard Modal if triggered */}
      {standaloneLeaderboardQuiz && (
        <LeaderboardModal
          quizId={standaloneLeaderboardQuiz.id}
          quizTitle={standaloneLeaderboardQuiz.title}
          isCreatorOrAdmin={user?.role === 'creator' || user?.role === 'admin'}
          onClose={() => setStandaloneLeaderboardQuiz(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
