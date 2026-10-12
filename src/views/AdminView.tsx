import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  AdminStats,
  User,
  Quiz,
  SystemSettings,
  PaymentRequest,
  CreatorSummary,
} from '../types.ts';
import {
  Shield,
  Users,
  FileQuestion,
  BookOpen,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  Activity,
  CreditCard,
  Building,
  Calendar,
  Clock,
  Check,
  X,
  ExternalLink,
  Sliders,
  DollarSign,
  UserCheck,
  UserX,
  PlusCircle,
  MessageCircle,
  Eye,
  Filter,
} from 'lucide-react';

interface AdminViewProps {
  onNavigate: (tab: string, meta?: any) => void;
}

type AdminTab = 'creators' | 'payments' | 'settings' | 'users_quizzes';

export const AdminView: React.FC<AdminViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [currentAdminTab, setCurrentAdminTab] = useState<AdminTab>('creators');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userList, setUserList] = useState<User[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [creators, setCreators] = useState<CreatorSummary[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search States
  const [creatorSearchCode, setCreatorSearchCode] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [searchQuiz, setSearchQuiz] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');

  // Modals
  const [selectedCreatorForDetail, setSelectedCreatorForDetail] = useState<any | null>(null);
  const [activateCreatorModal, setActivateCreatorModal] = useState<CreatorSummary | null>(null);
  const [activationDays, setActivationDays] = useState<number>(30);
  const [activationNotes, setActivationNotes] = useState<string>('');

  const [setExpiryModal, setSetExpiryModal] = useState<CreatorSummary | null>(null);
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');

  const [verifyPaymentModal, setVerifyPaymentModal] = useState<PaymentRequest | null>(null);
  const [verifyDurationDays, setVerifyDurationDays] = useState<number>(30);

  const [rejectPaymentModal, setRejectPaymentModal] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [viewPaymentModal, setViewPaymentModal] = useState<PaymentRequest | null>(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<Partial<SystemSettings>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, quizzesRes, creatorsRes, paymentsRes, settingsRes] =
        await Promise.all([
          api.getAdminStats(),
          api.getUsers(),
          api.getQuizzes(),
          api.getAdminCreators(),
          api.getAdminPaymentRequests(),
          api.getAdminSettings(),
        ]);

      setStats(statsRes);
      setUserList(usersRes.users || []);
      setQuizzes(quizzesRes.quizzes || []);
      setCreators(creatorsRes.creators || []);
      setPaymentRequests(paymentsRes.requests || []);
      setSettings(settingsRes.settings);
      setSettingsForm(settingsRes.settings);
    } catch (e: any) {
      console.error('Failed to load admin telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Quick Toggle Master Switch (Payment ON/OFF)
  const handleTogglePaymentMaster = async () => {
    if (!settings) return;
    const newState = !settings.paymentSystemEnabled;
    try {
      const res = await api.updateAdminSettings({ paymentSystemEnabled: newState });
      setSettings(res.settings);
      setSettingsForm(res.settings);
      showToast(`Creator Payment System switched ${newState ? 'ON' : 'OFF'}.`);
    } catch (e: any) {
      alert(e.message || 'Failed to update payment system master switch.');
    }
  };

  // Search Creators by unique creator code, email, or name (Requirement 7)
  const handleSearchCreators = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const query = creatorSearchCode.trim();
      const res = await api.getAdminCreators({
        search: query || undefined,
      });
      setCreators(res.creators || []);
    } catch (e: any) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Open Full Creator Detail
  const handleViewCreatorDetail = async (creatorId: string) => {
    try {
      const res = await api.getAdminCreator(creatorId);
      setSelectedCreatorForDetail(res);
    } catch (e: any) {
      alert(e.message || 'Failed to load creator details.');
    }
  };

  // Activate Creator
  const handleConfirmActivateCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateCreatorModal) return;

    try {
      await api.activateAdminCreator(
        activateCreatorModal.id,
        activationDays,
        activationNotes.trim() || undefined
      );
      showToast(`Creator ${activateCreatorModal.fullName} activated for ${activationDays} days.`);
      setActivateCreatorModal(null);
      setActivationNotes('');
      fetchAdminData();
    } catch (e: any) {
      alert(e.message || 'Failed to activate creator.');
    }
  };

  // Change Expiry Date
  const handleConfirmSetExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setExpiryModal || !customExpiryDate) return;

    try {
      await api.setAdminCreatorExpiry(setExpiryModal.id, customExpiryDate);
      showToast(`Expiry date updated for ${setExpiryModal.fullName}.`);
      setSetExpiryModal(null);
      fetchAdminData();
    } catch (e: any) {
      alert(e.message || 'Failed to update expiry date.');
    }
  };

  // Toggle Creator Access
  const handleToggleCreatorAccess = async (creator: CreatorSummary) => {
    try {
      await api.toggleAdminCreatorAccess(creator.id);
      showToast(`Access toggled for ${creator.fullName}.`);
      fetchAdminData();
    } catch (e: any) {
      alert(e.message || 'Failed to toggle creator access.');
    }
  };

  // Verify Payment Request
  const handleConfirmVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPaymentModal) return;

    try {
      await api.verifyPaymentRequest(verifyPaymentModal.id, verifyDurationDays);
      showToast(
        `Payment request verified! Creator account activated for ${verifyDurationDays} days.`
      );
      setVerifyPaymentModal(null);
      fetchAdminData();
    } catch (e: any) {
      alert(e.message || 'Failed to verify payment request.');
    }
  };

  // Reject Payment Request
  const handleConfirmRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectPaymentModal) return;

    try {
      await api.rejectPaymentRequest(
        rejectPaymentModal.id,
        rejectReason.trim() || 'Payment reference could not be verified in bank records.'
      );
      showToast(`Payment request marked as rejected.`);
      setRejectPaymentModal(null);
      setRejectReason('');
      fetchAdminData();
    } catch (e: any) {
      alert(e.message || 'Failed to reject payment request.');
    }
  };

  // Delete Payment Request
  const handleDeletePaymentRequest = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment request record?')) return;
    try {
      await api.deletePaymentRequest(id);
      setPaymentRequests((prev) => prev.filter((r) => r.id !== id));
      showToast('Payment request removed.');
    } catch (e: any) {
      alert(e.message || 'Failed to delete payment request.');
    }
  };

  // Save System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSettingsSaving(true);
      const res = await api.updateAdminSettings({
        ...settingsForm,
        currency: settingsForm.currency ? settingsForm.currency : 'NGN',
      });
      setSettings(res.settings);
      setSettingsForm(res.settings);
      showToast('System & Payment settings updated successfully.');
    } catch (e: any) {
      alert(e.message || 'Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Toggle user disabled
  const handleToggleDisableUser = async (targetUser: User) => {
    try {
      const res = await api.toggleUserDisabled(targetUser.id);
      setUserList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, disabled: res.disabled } : u))
      );
      showToast(`User ${targetUser.email} status updated.`);
    } catch (e: any) {
      alert(e.message || 'Failed to update user status.');
    }
  };

  // Give a user a temporary password
  const handleResetUserPassword = async (targetUser: User) => {
    if (!confirm(`Set a temporary password for ${targetUser.email}? Their old password will stop working.`)) return;
    try {
      const res = await api.adminResetPassword(targetUser.id);
      window.prompt(`Temporary password for ${res.email}. Copy it and send it to them, then ask them to change it in Settings:`, res.tempPassword);
    } catch (e: any) {
      alert(e.message || 'Failed to reset password.');
    }
  };

  // Delete quiz
  const handleDeleteQuiz = async (quizId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    try {
      await api.deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      showToast(`Quiz "${title}" permanently removed.`);
    } catch (e: any) {
      alert(e.message || 'Failed to delete quiz.');
    }
  };

  // Filtered payment requests
  const filteredPaymentRequests = paymentRequests.filter((r) => {
    if (paymentStatusFilter === 'all') return true;
    return r.status === paymentStatusFilter;
  });

  const filteredUsers = userList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.role.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuiz.toLowerCase()) ||
      q.creatorName.toLowerCase().includes(searchQuiz.toLowerCase()) ||
      q.shareCode.toLowerCase().includes(searchQuiz.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
            System Governance & Creator Access Management
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Platform Administration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage creator subscriptions, search creator account codes, verify manual bank transfers, and oversee exams
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Database</span>
        </button>
      </div>

      {/* ========================================================
          REQUIREMENT 7: ADMIN STATISTICS (Real Data from Database)
          - Total users
          - Total creators
          - Active creators
          - Expired creators
          - Total quizzes
          - Total participants
          - Active Learning Hubs
          - Pending payment requests
         ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Users
          </span>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {stats?.totalUsers ?? userList.length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Creators
          </span>
          <p className="text-xl font-extrabold text-blue-700 mt-1 tabular-nums">
            {stats?.totalCreators ?? creators.length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Creators
          </span>
          <p className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">
            {stats?.activeCreators ?? creators.filter((c) => c.accessStatus === 'active').length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Expired Creators
          </span>
          <p className="text-xl font-extrabold text-rose-600 mt-1 tabular-nums">
            {stats?.expiredCreators ?? creators.filter((c) => c.accessStatus === 'expired').length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Quizzes
          </span>
          <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {stats?.totalQuizzes ?? quizzes.length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Participants
          </span>
          <p className="text-xl font-extrabold text-indigo-700 mt-1 tabular-nums">
            {stats?.totalParticipants ?? 0}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Learning Hubs
          </span>
          <p className="text-xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {stats?.totalHubs ?? 0}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Pending Pay
          </span>
          <p className="text-xl font-extrabold text-rose-600 mt-1 tabular-nums">
            {stats?.pendingPaymentRequests ?? paymentRequests.filter((r) => r.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* ========================================================
          REQUIREMENT 3 & 11: MASTER SWITCH (Creator Payment System ON / OFF)
         ======================================================== */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              Master Access Policy
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                settings?.paymentSystemEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {settings?.paymentSystemEnabled ? 'PAYMENT SYSTEM: ON' : 'PAYMENT SYSTEM: OFF (FREE MODE)'}
            </span>
          </div>
          <h2 className="text-base font-bold">
            Creator Payment & Access Control Switch
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {settings?.paymentSystemEnabled
              ? 'Payment system is currently ACTIVE. Creators are subject to trial and paid subscription limits. Normal students remain 100% free.'
              : 'Payment system is currently OFF. Creators can create unlimited quizzes and learning hubs without any payment restrictions.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePaymentMaster}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs shrink-0 ${
            settings?.paymentSystemEnabled
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          <span>Switch Payment {settings?.paymentSystemEnabled ? 'OFF (Free Mode)' : 'ON (Require Payment)'}</span>
        </button>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setCurrentAdminTab('creators')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
            currentAdminTab === 'creators'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Creator Directory & Code Search</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-black/20">
            {creators.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentAdminTab('payments')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
            currentAdminTab === 'payments'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Requests</span>
          {(stats?.pendingPaymentRequests ?? 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {stats?.pendingPaymentRequests}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentAdminTab('settings')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
            currentAdminTab === 'settings'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Payment & Bank Settings</span>
        </button>

        <button
          onClick={() => setCurrentAdminTab('users_quizzes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
            currentAdminTab === 'users_quizzes'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Quizzes Governance</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: CREATOR DIRECTORY & CODE SEARCH (Requirement 1 & 8)
         ======================================================== */}
      {currentAdminTab === 'creators' && (
        <div className="space-y-5">
          {/* Prominent Search Box by Unique Creator Code */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" />
                  <span>Search Creator by Unique Account Code</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Search any creator by their official code (e.g. <code>REM-8K29X</code>, <code>REM-ADMIN1</code>) or email
                </p>
              </div>

              <form onSubmit={handleSearchCreators} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter code (e.g. REM-8K29X)..."
                    value={creatorSearchCode}
                    onChange={(e) => setCreatorSearchCode(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0"
                >
                  Search
                </button>
                {creatorSearchCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreatorSearchCode('');
                      api.getAdminCreators().then((res) => setCreators(res.creators || []));
                    }}
                    className="px-3 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>

            {/* Creators Table / Card list (Requirement 7) */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-3">Creator Name</th>
                    <th className="py-3 px-3">Creator Code</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Access Start Date</th>
                    <th className="py-3 px-2">Expiry Date</th>
                    <th className="py-3 px-2 text-center">Quizzes Created</th>
                    <th className="py-3 px-2 text-center">Total Participants</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creators.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No creator accounts matched your search criteria.
                      </td>
                    </tr>
                  ) : (
                    creators.map((c) => {
                      const isExpired = c.accessStatus === 'expired';
                      const isActive = c.accessStatus === 'active';
                      const isDisabled = c.accessStatus === 'disabled';

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {c.fullName}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                              {c.creatorCode}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                            {c.email}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isExpired
                                  ? 'bg-rose-100 text-rose-800'
                                  : isDisabled
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.accessStatus}
                            </span>
                            {c.accessStatus === 'trial' && (
                              <span className="ml-1.5 text-[10px] text-slate-500">
                                {c.trialQuizzesUsed ?? 0}/{c.trialQuizzesAllowed ?? 0} quizzes
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-600 font-mono text-[11px]">
                            {c.accessStartedAt ? (
                              new Date(c.accessStartedAt).toLocaleDateString()
                            ) : c.createdAt ? (
                              new Date(c.createdAt).toLocaleDateString()
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-600 font-mono text-[11px]">
                            {c.accessExpiresAt ? (
                              <span className={isExpired ? 'text-rose-600 font-bold' : ''}>
                                {new Date(c.accessExpiresAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">None set</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-800 tabular-nums">
                            {c.quizzesCount}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-800 tabular-nums">
                            {c.totalParticipants}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* View Quizzes action */}
                              <button
                                type="button"
                                onClick={() => handleViewCreatorDetail(c.id)}
                                className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md font-semibold text-[11px]"
                                title="View Quizzes & Profile"
                              >
                                View Quizzes
                              </button>

                              {/* Activate / Extend Access */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActivateCreatorModal(c);
                                  setActivationDays(settings?.paidAccessDurationDays || 30);
                                }}
                                className="px-2.5 py-1 text-white bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold text-[11px]"
                                title={isActive ? 'Extend access duration' : 'Activate creator access'}
                              >
                                {isActive ? 'Extend' : 'Activate'}
                              </button>

                              {/* Change Expiry */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSetExpiryModal(c);
                                  setCustomExpiryDate(
                                    c.accessExpiresAt ? c.accessExpiresAt.split('T')[0] : ''
                                  );
                                }}
                                className="px-2 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-semibold text-[11px]"
                                title="Change expiry date"
                              >
                                Change Expiry
                              </button>

                              {/* Enable / Disable */}
                              <button
                                type="button"
                                onClick={() => handleToggleCreatorAccess(c)}
                                className={`px-2 py-1 rounded-md font-semibold text-[11px] ${
                                  isDisabled
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                }`}
                                title="Toggle creator account access"
                              >
                                {isDisabled ? 'Enable' : 'Disable'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: PAYMENT REQUESTS (Requirement 4 & 5)
         ======================================================== */}
      {currentAdminTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Manual Bank Transfer Payment Requests</span>
              </h2>
              <p className="text-xs text-slate-500">
                Verify manual bank payments submitted by creators and activate subscriptions
              </p>
            </div>

            {/* Filter status */}
            <div className="flex items-center gap-1.5">
              {['all', 'pending', 'verified', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setPaymentStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-colors ${
                    paymentStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-3 px-4">Creator / Code</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Date / Time</th>
                  <th className="py-3 px-3">Sender & Reference</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPaymentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No payment requests found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredPaymentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{req.creatorName}</span>
                        <span className="font-mono text-[11px] text-blue-700 font-bold">
                          {req.creatorCode}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{req.creatorEmail}</span>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-xs">
                        {req.currency} {req.amount.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(req.requestedAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-slate-700 text-xs">
                        <span className="font-semibold block">{req.senderName}</span>
                        <span className="font-mono text-[11px] text-slate-500 block">
                          Ref: {req.referenceNumber}
                        </span>
                        {req.senderBank && (
                          <span className="text-[10px] text-slate-400 block">{req.senderBank}</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            req.status === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          {req.status}
                        </span>
                        {req.status === 'verified' && req.durationGrantedDays && (
                          <span className="text-[10px] text-emerald-700 block font-mono mt-0.5">
                            +{req.durationGrantedDays} days
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setViewPaymentModal(req)}
                            className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-semibold text-[11px]"
                          >
                            Details
                          </button>

                          {req.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setVerifyPaymentModal(req);
                                  setVerifyDurationDays(settings?.paidAccessDurationDays || 30);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold text-[11px]"
                              >
                                Verify & Activate
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectPaymentModal(req)}
                                className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md font-semibold text-[11px]"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeletePaymentRequest(req.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: SYSTEM & PAYMENT SETTINGS (Requirement 3 & 4)
         ======================================================== */}
      {currentAdminTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Access Duration & Fee Configuration</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Configure trial periods, subscription fees, access durations, and feature gates
                </p>
              </div>

              <button
                type="submit"
                disabled={settingsSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {/* General Access Rules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Free Trial for New Creators</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.freeTrialEnabled)}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, freeTrialEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  Allows newly registered creators a trial before payment is required.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Free quizzes for new creators
                </label>
                <input
                  type="number"
                  min={0}
                  value={settingsForm.freeTrialQuizzes ?? ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      freeTrialQuizzes: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  New creators start a free trial with this many quizzes. It applies to new sign-ups only.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Paid Access Duration (Days per activation)
                </label>
                <input
                  type="number"
                  min={1}
                  value={settingsForm.paidAccessDurationDays ?? ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      paidAccessDurationDays: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Access Fee Amount
                </label>
                <input
                  type="number"
                  min={0}
                  value={settingsForm.accessFeeAmount ?? ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      accessFeeAmount: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Currency Symbol / Code
                </label>
                <input
                  type="text"
                  value={settingsForm.currency ?? ''}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, currency: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>
            </div>

            {/* Feature Restriction Gates */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Restricted Creator Features (When Payment is ON & Expired)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.requirePaymentForQuizCreation)}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        requirePaymentForQuizCreation: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Block Quiz Creation when expired</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.requirePaymentForHubCreation)}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        requirePaymentForHubCreation: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Block Learning Hub Creation when expired</span>
                </label>
              </div>
            </div>

            {/* Bank Transfer Instructions Config (Requirement 4) */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Manual Bank Transfer Instructions for Creators</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These details will be displayed to creators when they click &quot;Activate / Upgrade Creator Access&quot;
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.bankDetails?.bankName || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bankDetails: {
                          ...(settingsForm.bankDetails as any),
                          bankName: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Zenith Bank"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.bankDetails?.accountName || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bankDetails: {
                          ...(settingsForm.bankDetails as any),
                          accountName: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Remedi Pro Educational Services"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.bankDetails?.accountNumber || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bankDetails: {
                          ...(settingsForm.bankDetails as any),
                          accountNumber: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. 1018923456"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    WhatsApp Number for Receipts & Support
                  </label>
                  <input
                    type="text"
                    value={settingsForm.bankDetails?.whatsappNumber || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bankDetails: {
                          ...(settingsForm.bankDetails as any),
                          whatsappNumber: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. +234 812 345 6789"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Payment Instructions / Narration Advice
                  </label>
                  <textarea
                    rows={2}
                    value={settingsForm.bankDetails?.instructions || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        bankDetails: {
                          ...(settingsForm.bankDetails as any),
                          instructions: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Transfer access fee with your Creator Code as narration..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================
          TAB 4: USERS & QUIZZES GOVERNANCE (Existing tools preserved)
         ======================================================== */}
      {currentAdminTab === 'users_quizzes' && (
        <div className="space-y-6">
          {/* User Management Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Platform User Directory</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage candidate and educator accounts across the platform
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3 px-3">
                        <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            u.disabled
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {u.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {u.id !== 'usr_admin' && (
                          <button
                            onClick={() => handleResetUserPassword(u)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            Reset Password
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleDisableUser(u)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            u.disabled
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {u.disabled ? 'Enable Account' : 'Disable Account'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quiz Moderation Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-blue-600" />
                  <span>Assessment Registry & Moderation</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Audit active quizzes, review inappropriate content, and delete unauthorized items
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search quiz..."
                  value={searchQuiz}
                  onChange={(e) => setSearchQuiz(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Title</th>
                    <th className="py-2.5 px-3">Creator</th>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Subjects</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuizzes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900 max-w-xs truncate">{q.title}</td>
                      <td className="py-3 px-3 text-slate-600">{q.creatorName}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-blue-700">{q.shareCode}</td>
                      <td className="py-3 px-3 text-slate-500 truncate max-w-[150px]">
                        {q.subjects.join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteQuiz(q.id, q.title)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Platform Audit Trail</span>
            </h2>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(stats?.auditLogs || []).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mr-2">
                      {log.action}
                    </span>
                    <span className="text-slate-700">{log.details}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ACTIVATE CREATOR (Admin selects duration)
         ======================================================== */}
      {activateCreatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmActivateCreator}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Activate Creator Account</h3>
              <button
                type="button"
                onClick={() => setActivateCreatorModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
              <p>
                Creator: <strong>{activateCreatorModal.fullName}</strong> ({activateCreatorModal.email})
              </p>
              <p className="font-mono">
                Code: <strong>{activateCreatorModal.creatorCode}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Access Duration (Days)
              </label>
              <select
                value={activationDays}
                onChange={(e) => setActivationDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              >
                <option value={7}>7 Days (1 Week Trial / Promo)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={30}>30 Days (1 Month Standard)</option>
                <option value={60}>60 Days (2 Months)</option>
                <option value={90}>90 Days (1 Quarter)</option>
                <option value={180}>180 Days (Half Year)</option>
                <option value={365}>365 Days (1 Full Year)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Internal Notes / Reference (Optional)
              </label>
              <textarea
                rows={2}
                value={activationNotes}
                onChange={(e) => setActivationNotes(e.target.value)}
                placeholder="e.g. Verified bank transfer reference #TRF123"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActivateCreatorModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs"
              >
                Confirm & Activate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL: SET CUSTOM EXPIRY DATE
         ======================================================== */}
      {setExpiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmSetExpiry}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Change Expiry Date</h3>
              <button
                type="button"
                onClick={() => setSetExpiryModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Manually set the exact date when creator access for <strong>{setExpiryModal.fullName}</strong> ({setExpiryModal.creatorCode}) will expire.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                New Expiry Date
              </label>
              <input
                type="date"
                required
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSetExpiryModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs"
              >
                Update Expiry Date
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL: VERIFY & ACTIVATE PAYMENT REQUEST
         ======================================================== */}
      {verifyPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmVerifyPayment}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Verify Payment & Activate Creator</h3>
              <button
                type="button"
                onClick={() => setVerifyPaymentModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Creator:</span>
                <strong>{verifyPaymentModal.creatorName}</strong>
              </div>
              <div className="flex justify-between font-mono">
                <span>Creator Code:</span>
                <strong>{verifyPaymentModal.creatorCode}</strong>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <strong>{verifyPaymentModal.currency} {verifyPaymentModal.amount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between font-mono">
                <span>Narration/Ref:</span>
                <strong className="text-blue-700">{verifyPaymentModal.referenceNumber}</strong>
              </div>
              {verifyPaymentModal.senderBank && (
                <div className="flex justify-between">
                  <span>Sender Bank:</span>
                  <span>{verifyPaymentModal.senderBank}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Access Duration to Grant (Days)
              </label>
              <select
                value={verifyDurationDays}
                onChange={(e) => setVerifyDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              >
                <option value={30}>30 Days (Standard 1 Month)</option>
                <option value={60}>60 Days (2 Months)</option>
                <option value={90}>90 Days (3 Months)</option>
                <option value={180}>180 Days (Half Year)</option>
                <option value={365}>365 Days (1 Full Year)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVerifyPaymentModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs"
              >
                Verify & Grant Access
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL: REJECT PAYMENT REQUEST
         ======================================================== */}
      {rejectPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmRejectPayment}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reject Payment Request</h3>
              <button
                type="button"
                onClick={() => setRejectPaymentModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Provide a reason for rejecting the payment request from <strong>{rejectPaymentModal.creatorName}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rejection Reason
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Bank transfer reference not found in bank statement, or incorrect amount paid."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectPaymentModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL: VIEW PAYMENT DETAILS
         ======================================================== */}
      {viewPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Payment Request Details</h3>
              <button
                type="button"
                onClick={() => setViewPaymentModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 divide-y divide-slate-100">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Creator:</span>
                <span className="font-bold">{viewPaymentModal.creatorName}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Creator Code:</span>
                <span className="font-mono font-bold text-blue-700">{viewPaymentModal.creatorCode}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono">{viewPaymentModal.creatorEmail}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-sm text-slate-900">
                  {viewPaymentModal.currency} {viewPaymentModal.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono font-bold text-blue-800">{viewPaymentModal.referenceNumber}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Sender Account:</span>
                <span>{viewPaymentModal.senderName}</span>
              </div>
              {viewPaymentModal.senderBank && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Sender Bank:</span>
                  <span>{viewPaymentModal.senderBank}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Submitted:</span>
                <span className="font-mono">{new Date(viewPaymentModal.requestedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold uppercase tracking-wider">{viewPaymentModal.status}</span>
              </div>
              {viewPaymentModal.notes && (
                <div className="py-2">
                  <span className="text-slate-500 block mb-1">Notes / Receipt:</span>
                  <p className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-mono text-[11px] break-all">
                    {viewPaymentModal.notes}
                  </p>
                </div>
              )}
              {viewPaymentModal.rejectionReason && (
                <div className="py-2 text-rose-700">
                  <span className="block font-bold">Rejection Reason:</span>
                  <p>{viewPaymentModal.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewPaymentModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATOR FULL DETAILS (Quizzes, Participants, Hubs)
         ======================================================== */}
      {selectedCreatorForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">{selectedCreatorForDetail.creator.fullName}</h3>
                <p className="text-xs text-blue-300 font-mono">
                  Code: {selectedCreatorForDetail.creator.creatorCode} • {selectedCreatorForDetail.creator.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedCreatorForDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Status metrics banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Access Status</span>
                  <span className="font-bold text-slate-900 capitalize text-sm">
                    {selectedCreatorForDetail.creator.accessStatus}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Expiry Date</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {selectedCreatorForDetail.creator.accessExpiresAt
                      ? new Date(selectedCreatorForDetail.creator.accessExpiresAt).toLocaleDateString()
                      : 'None'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Quizzes</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedCreatorForDetail.quizzes.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Candidates</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedCreatorForDetail.creator.totalParticipants}
                  </span>
                </div>
              </div>

              {/* Creator Quizzes list */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs mb-2">
                  Created Quizzes ({selectedCreatorForDetail.quizzes.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedCreatorForDetail.quizzes.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">No quizzes created yet.</div>
                  ) : (
                    selectedCreatorForDetail.quizzes.map((q: any) => (
                      <div key={q.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">{q.title}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Code: {q.shareCode} • {q.subjects.join(', ')}
                          </span>
                        </div>
                        <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded text-xs">
                          {q.participantCount} candidates
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Learning Hubs */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-800 text-xs mb-2">
                  Learning Hubs ({selectedCreatorForDetail.hubs.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedCreatorForDetail.hubs.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">No learning hubs established.</div>
                  ) : (
                    selectedCreatorForDetail.hubs.map((h: any) => (
                      <div key={h.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">{h.title}</span>
                          <span className="text-[11px] text-slate-500">{h.subject}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCreatorForDetail(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
