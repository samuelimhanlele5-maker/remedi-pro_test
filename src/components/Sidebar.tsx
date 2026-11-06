import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  LayoutDashboard,
  FileQuestion,
  PlusCircle,
  BookOpen,
  Compass,
  BarChart3,
  Users,
  User,
  Settings,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAuthModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const isGuest = !user;

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const navItems = isGuest
    ? [{ id: 'dashboard', label: 'Public Quizzes', icon: LayoutDashboard }]
    : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-quizzes', label: 'My Quizzes', icon: FileQuestion },
    ...(isCreatorOrAdmin ? [{ id: 'create-quiz', label: 'Create Quiz', icon: PlusCircle }] : []),
    { id: 'learning-hub', label: 'Learning Hub', icon: BookOpen },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'browse-hub', label: 'Browse Hub', icon: Compass },
    { id: 'analytics', label: 'Results & Analytics', icon: BarChart3 },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(isAdmin ? [{ id: 'admin', label: 'Platform Admin', icon: Shield }] : []),
  ];

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar: Desktop fixed & Mobile slide-over drawer */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Main Menu
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {isGuest && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                Create a free account to unlock creator tools: build quizzes, run mocks and track results.
              </p>
              <button
                onClick={() => {
                  onOpenAuthModal?.();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
              >
                Create account / Log in
              </button>
            </div>
          )}

          {/* Creator Tools Section */}
          {isCreatorOrAdmin && (
            <div>
              <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Creator Tools
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleSelect('my-quizzes')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                    currentTab === 'my-quizzes'
                      ? 'bg-slate-800 text-blue-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Manage Quizzes</span>
                </button>
                <button
                  onClick={() => handleSelect('learning-hub')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                    currentTab === 'learning-hub'
                      ? 'bg-slate-800 text-blue-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Learning Hub</span>
                </button>
                <button
                  onClick={() => handleSelect('profile')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-left transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => handleSelect('settings')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-left transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-400" />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Notice Card */}
          {!isGuest && (
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
            <div className="flex items-center gap-2 mb-1.5 text-blue-400 font-semibold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Remedi Pro Free</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Unrestricted access to CBT examination simulations, question creation, multi-subject analytics, and live monitoring.
            </p>
          </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Remedi Pro CBT</span>
          <span className="font-mono text-slate-400">v2026.1</span>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 flex items-center justify-around h-14 px-2 md:hidden">
        {isGuest ? (
          <>
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex flex-col items-center justify-center flex-1 py-1 text-blue-400"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-[10px] mt-1 font-medium">Quizzes</span>
            </button>
            <button
              onClick={() => onOpenAuthModal?.()}
              className="flex flex-col items-center justify-center flex-1 py-1 text-slate-300 hover:text-white"
            >
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] mt-1 font-medium">Account</span>
            </button>
          </>
        ) : (
          <>
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-[10px] mt-1 font-medium">Home</span>
        </button>
        <button
          onClick={() => onSelectTab('my-quizzes')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'my-quizzes' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span className="text-[10px] mt-1 font-medium">Quizzes</span>
        </button>
        {isCreatorOrAdmin && (
          <button
            onClick={() => onSelectTab('create-quiz')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'create-quiz' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] mt-1 font-medium">Create</span>
          </button>
        )}
        <button
          onClick={() => onSelectTab('learning-hub')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'learning-hub' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px] mt-1 font-medium">Hub</span>
        </button>
        <button
          onClick={() => onSelectTab('analytics')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            currentTab === 'analytics' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[10px] mt-1 font-medium">Results</span>
        </button>
          </>
        )}
      </nav>
    </>
  );
};
