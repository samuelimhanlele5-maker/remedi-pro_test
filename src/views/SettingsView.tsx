import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PasswordInput } from '../components/PasswordInput.tsx';
import {
  KeyRound,
  Shield,
  Bell,
  Eye,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, resetPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preference switches
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setSavingPassword(true);
      if (user?.email) {
        await resetPassword(user.email, newPassword, currentPassword);
        setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (e: any) {
      setPasswordMsg({ type: 'error', text: e.message || 'Failed to update password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
            System & Security
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure authentication credentials, examination environment, and accessibility options
          </p>
        </div>
      </div>

      {/* Password Reset Section (Requirement 2) */}
      <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Password & Security
          </h2>
        </div>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
          <PasswordInput
            required
            placeholder="Your current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <PasswordInput
              required
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <PasswordInput
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingPassword}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* CBT Environment Preferences */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          CBT Examination Preferences
        </h2>

        <div className="space-y-3 divide-y divide-slate-100">
          <div className="pt-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Timer Audio Alert
              </span>
              <span className="text-[11px] text-slate-400">
                Play subtle pulse notification when 3 minutes remain
              </span>
            </div>
            <input
              type="checkbox"
              checked={soundFeedback}
              onChange={(e) => setSoundFeedback(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Auto-advance on Answer Selection
              </span>
              <span className="text-[11px] text-slate-400">
                Move directly to next question when option is picked
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                High Legibility Display Mode
              </span>
              <span className="text-[11px] text-slate-400">
                Enlarge reading passage and question text for readability
              </span>
            </div>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
