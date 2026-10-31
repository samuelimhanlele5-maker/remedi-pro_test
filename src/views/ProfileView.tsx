import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { UserRole, CreatorAccessStatus, LearningHub } from '../types.ts';
import { HubFormModal } from '../components/HubFormModal.tsx';
import { CreatorPaymentModal } from '../components/CreatorPaymentModal.tsx';
import {
  User as UserIcon,
  Mail,
  Shield,
  Briefcase,
  CheckCircle,
  Edit,
  Save,
  GraduationCap,
  Layers,
  Copy,
  CreditCard,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Plus,
  Check,
} from 'lucide-react';

interface ProfileViewProps {
  onNavigate: (tab: string, meta?: any) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { user, updateProfile, switchRole } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'student');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Learning hubs: create from here, and see hubs I own or joined
  const [hubs, setHubs] = useState<LearningHub[]>([]);
  const [hubFormOpen, setHubFormOpen] = useState(false);
  const [createdHub, setCreatedHub] = useState<LearningHub | null>(null);
  const [hubLinkCopied, setHubLinkCopied] = useState(false);

  const loadHubs = async () => {
    try {
      const res = await api.getHubs();
      setHubs(res.hubs || []);
    } catch {}
  };

  useEffect(() => {
    loadHubs();
  }, []);

  const copyHubLink = async (h: LearningHub) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?hub=${h.hubCode || h.id}`);
      setHubLinkCopied(true);
      setTimeout(() => setHubLinkCopied(false), 2000);
    } catch {}
  };

  // Creator Access Info
  const [creatorAccess, setCreatorAccess] = useState<CreatorAccessStatus | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';

  useEffect(() => {
    if (isCreatorOrAdmin) {
      api.getCreatorAccessStatus()
        .then((res) => setCreatorAccess(res))
        .catch(() => {});
    }
  }, [isCreatorOrAdmin]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({
        fullName: fullName.trim(),
        bio: bio.trim(),
        role: selectedRole,
      });
      setSuccessMsg('Profile updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);

      // Re-fetch creator status if role changed
      if (selectedRole === 'creator') {
        const res = await api.getCreatorAccessStatus();
        setCreatorAccess(res);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const creatorCode = user?.creatorCode || creatorAccess?.creatorCode || 'REM-CREATOR';

  return (
    <div className="space-y-6 max-w-3xl mx-auto font-sans">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
            Account Identity & Membership
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">User Profile</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal profile, credentials, and educator access privileges
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================
          REQUIREMENT 2 & 9: UNIQUE CREATOR CODE & ACCESS STATUS
          (Visible to creators and admins, completely hidden from students)
         ======================================================== */}
      {isCreatorOrAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
                Official Account Identifier
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">Creator Account Code</h3>
            </div>

            {/* Creator Code Pill with Copy */}
            <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-sm font-black font-mono tracking-wider text-blue-300">
                {creatorCode}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(creatorCode)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                title="Copy Creator Code"
              >
                {copiedCode ? (
                  <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Access Status & Expiry Grid (Requirement 9) */}
          {(() => {
            const expiryDate = creatorAccess?.accessExpiresAt || user?.accessExpiresAt;
            const isAccessExpired =
              creatorAccess?.accessStatus === 'expired' ||
              (expiryDate ? new Date(expiryDate).getTime() < Date.now() : false);
            const remainingDays = expiryDate
              ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Creator Status
                  </span>
                  <span className="font-bold text-white">
                    {user?.role === 'admin' ? 'Administrator' : 'Educator Creator'}
                  </span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Account Status
                  </span>
                  <span
                    className={`font-extrabold uppercase text-[11px] px-2 py-0.5 rounded inline-block ${
                      isAccessExpired
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : creatorAccess?.accessStatus === 'disabled'
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isAccessExpired ? 'EXPIRED' : creatorAccess?.accessStatus || user?.accessStatus || 'ACTIVE'}
                  </span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Access Expiry Date
                  </span>
                  <span className="font-mono text-white text-[11px]">
                    {expiryDate ? (
                      new Date(expiryDate).toLocaleDateString()
                    ) : (
                      <span className="text-slate-400">Unlimited / Active</span>
                    )}
                  </span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Remaining Days
                  </span>
                  <span className="font-bold text-[11px]">
                    {expiryDate ? (
                      isAccessExpired ? (
                        <span className="text-rose-400">0 Days (Expired)</span>
                      ) : (
                        <span className="text-emerald-400">{remainingDays} Days Left</span>
                      )
                    ) : (
                      <span className="text-emerald-400">Unlimited</span>
                    )}
                  </span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2 sm:col-span-4 lg:col-span-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Payment Policy
                  </span>
                  <span className="text-slate-300 text-[11px]">
                    {creatorAccess?.paymentSystemEnabled
                      ? 'Payment Enforced'
                      : 'Free Access Active'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* If Payment System is ON and Creator needs activation or renewal */}
          {creatorAccess?.paymentSystemEnabled && (
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {creatorAccess.pendingRequest ? (
                  <span className="text-amber-400 font-semibold">
                    Payment verification pending (Ref: {creatorAccess.pendingRequest.referenceNumber}).
                  </span>
                ) : (
                  'Need to extend or activate your creator access? Submit manual bank transfer confirmation.'
                )}
              </p>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {creatorAccess.pendingRequest ? 'View Payment Details' : 'Upgrade / Renew Access'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Profile Card */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Avatar and Role */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-sm">
            {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{fullName || 'User'}</h2>
            <p className="text-xs text-slate-500 font-mono">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                {user?.role}
              </span>
              <span className="text-[11px] text-slate-400">
                Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Educational Bio / Focus
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Senior biology instructor preparing candidates for CBT examinations..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {user?.role !== 'admin' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Account Role / Mode
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setSelectedRole('student')}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                    selectedRole === 'student'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                    <span>Student</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500">
                    Take tests, join hubs, and view diagnostics. Always 100% free.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('creator')}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                    selectedRole === 'creator'
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Creator</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500">
                    Author quizzes, create hubs, and get unique account code.
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* Learning Hub: create here, and see my hubs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-extrabold text-slate-900">Learning Hub</h2>
          </div>
          {isCreatorOrAdmin && (
            <button
              onClick={() => setHubFormOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl"
            >
              <Plus className="w-4 h-4" /> Create Learning Hub
            </button>
          )}
        </div>

        {createdHub && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
            <p className="text-xs font-bold text-emerald-800">Hub created: {createdHub.title}</p>
            <p className="text-[11px] text-emerald-700 break-all">
              {window.location.origin}/?hub={createdHub.hubCode || createdHub.id}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => copyHubLink(createdHub)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white border border-emerald-200 rounded-lg"
              >
                {hubLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {hubLinkCopied ? 'Link copied' : 'Copy link'}
              </button>
              <button
                onClick={() => onNavigate('learning-hub', { hubId: createdHub.id })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg"
              >
                Open hub
              </button>
            </div>
          </div>
        )}

        {isCreatorOrAdmin && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-700">My hubs</p>
            {hubs.filter((h) => h.myStatus === 'owner').length === 0 ? (
              <p className="text-[11px] text-slate-500">You have not created a hub yet.</p>
            ) : (
              hubs
                .filter((h) => h.myStatus === 'owner')
                .map((h) => (
                  <div key={h.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{h.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {h.memberCount ?? 0} members · {(h.subjects || []).length} subjects ·{' '}
                        {h.accessType === 'paid' ? 'Paid' : 'Free'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => copyHubLink(h)}
                        className="p-2 text-slate-500 hover:text-blue-600 bg-slate-100 rounded-lg"
                        title="Copy hub link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onNavigate('learning-hub', { hubId: h.id })}
                        className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-700">Hubs I joined</p>
          {hubs.filter((h) => h.myStatus === 'active' || h.myStatus === 'pending').length === 0 ? (
            <p className="text-[11px] text-slate-500">You have not joined any hub yet. Find one in the Hub tab.</p>
          ) : (
            hubs
              .filter((h) => h.myStatus === 'active' || h.myStatus === 'pending')
              .map((h) => (
                <div key={h.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{h.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {h.myStatus === 'pending' ? 'Waiting for approval' : 'Member'} · by {h.creatorName}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate('learning-hub', { hubId: h.id })}
                    className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg shrink-0"
                  >
                    Open
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {hubFormOpen && (
        <HubFormModal
          onClose={() => setHubFormOpen(false)}
          onSaved={(h) => {
            setHubFormOpen(false);
            setCreatedHub(h);
            loadHubs();
          }}
        />
      )}

      {/* Payment Instructions Modal */}
      <CreatorPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onPaymentSubmitted={() => {
          api.getCreatorAccessStatus().then((res) => setCreatorAccess(res));
        }}
      />
    </div>
  );
};
