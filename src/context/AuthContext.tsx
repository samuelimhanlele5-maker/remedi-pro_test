import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, fullName: string, role?: string) => Promise<void>;
  logout: () => void;
  resetPassword: (email: string, newPass: string, currentPass?: string) => Promise<void>;
  updateProfile: (data: { fullName?: string; bio?: string; role?: UserRole }) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'remedi_user_session';
const LOCAL_STORAGE_TOKEN_KEY = 'remedi_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from local storage, then verify with server
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      const token = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
      if (saved && token) {
        setUser(JSON.parse(saved));
      } else if (saved) {
        // Old session without a signed login token: sign out so the person logs in again
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      }
    } catch (e) {
      console.error('Error loading stored user session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // One saved login is shared by every tab and the installed app. When it changes in one window
  // (another account logs in, or someone logs out), every other window switches to the same account
  // instead of showing one person's name with another person's data.
  useEffect(() => {
    const sync = () => {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        const token = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        const next: User | null = saved && token ? JSON.parse(saved) : null;
        setUser((cur) => ((cur?.id ?? null) === (next?.id ?? null) ? cur : next));
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LOCAL_STORAGE_USER_KEY || e.key === LOCAL_STORAGE_TOKEN_KEY) sync();
    };
    const onVisible = () => {
      if (!document.hidden) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, res.token);
    setUser(res.user);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(res.user));
  };

  const register = async (email: string, pass: string, fullName: string, role?: string) => {
    const res = await api.register({ email, password: pass, fullName, role });
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, res.token);
    setUser(res.user);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(res.user));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
  };

  const resetPassword = async (email: string, newPass: string, currentPass?: string) => {
    await api.resetPassword({ email, newPassword: newPass, currentPassword: currentPass });
  };

  const updateProfile = async (data: { fullName?: string; bio?: string; role?: UserRole }) => {
    if (!user) return;
    const res = await api.updateProfile(user.id, data);
    setUser(res.user);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(res.user));
  };

  const switchRole = async (newRole: UserRole) => {
    if (!user) return;
    await updateProfile({ role: newRole });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        resetPassword,
        updateProfile,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
