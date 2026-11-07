import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Sparkles,
  User as UserIcon,
  LogOut,
  Shield,
  Layers,
  GraduationCap,
  KeyRound,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuthModal: () => void;
  onOpenTakeQuizModal: () => void;
  onToggleMobileSidebar: () => void;
  mobileSidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuthModal,
  onOpenTakeQuizModal,
  onToggleMobileSidebar,
  mobileSidebarOpen,
}) => {
  const { user, logout, switchRole } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-slate-900 border-b border-slate-800 text-white select-none">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 md:hidden transition-colors"
          aria-label="Toggle navigation"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <button
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 text-left group"
        >
          <img
            src="/icon-192.png"
            alt="Remedi Pro"
            className="w-8 h-8 rounded-lg shadow-sm shadow-blue-500/20 group-hover:opacity-90 transition-opacity"
          />
          <div>
            <span className="text-lg font-bold tracking-tight text-white block leading-none">
              Remedi Pro
            </span>
            <span className="text-[11px] font-medium text-slate-400 block tracking-normal mt-0.5">
              Create · Share · Learn · Succeed
            </span>
          </div>
        </button>
      </div>

      {/* Zone 2: Fast Action Access */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={onOpenTakeQuizModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-200 bg-blue-950/60 border border-blue-800/80 rounded-lg hover:bg-blue-900/60 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Enter Quiz Code</span>
        </button>
        {user?.role === 'creator' || user?.role === 'admin' ? (
          <button
            onClick={() => onSelectTab('create-quiz')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/30"
          >
            + Create Quiz
          </button>
        ) : null}
      </div>

      {/* Zone 3: Profile & Role Actions */}
      <div className="flex items-center gap-3 relative">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-semibold text-xs">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                  {user.fullName}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">
                  {user.role}
                </p>
              </div>
            </button>

            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 z-50 text-slate-200">
                  <div className="px-4 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-900/50 text-blue-300 rounded border border-blue-800 uppercase tracking-wide">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1 border-b border-slate-800">
                    <button
                      onClick={() => {
                        onSelectTab('profile');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>View Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectTab('settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-slate-400" />
                      <span>Settings & Security</span>
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={() => {
                          onSelectTab('admin');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 text-blue-400 flex items-center gap-2.5 transition-colors font-medium"
                      >
                        <Shield className="w-4 h-4 text-blue-400" />
                        <span>Platform Administration</span>
                      </button>
                    )}
                  </div>

                  {/* Switch Role Fast Toggle */}
                  <div className="px-4 py-2 border-b border-slate-800 text-[11px] text-slate-400">
                    <p className="mb-1 font-medium text-slate-300">Switch workspace mode:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          switchRole('student');
                          setProfileDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-center font-medium transition-colors ${
                          user.role === 'student'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Student
                      </button>
                      <button
                        onClick={() => {
                          switchRole('creator');
                          setProfileDropdownOpen(false);
                        }}
                        className={`px-2 py-1 rounded text-center font-medium transition-colors ${
                          user.role === 'creator'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Creator
                      </button>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
          >
            Sign In / Register
          </button>
        )}
      </div>
    </header>
  );
};
