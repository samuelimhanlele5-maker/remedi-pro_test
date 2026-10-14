import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { Quiz, CreatorAccessStatus } from '../types.ts';
import { LiveParticipantsModal } from './LiveParticipantsModal.tsx';
import { LeaderboardModal } from './LeaderboardModal.tsx';
import { CreatorPaymentModal } from '../components/CreatorPaymentModal.tsx';
import {
  FileQuestion,
  Users,
  Award,
  BookOpen,
  PlusCircle,
  Radio,
  Trophy,
  Edit,
  Trash2,
  Share2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  CreditCard,
  Clock,
  Calendar,
  Shield,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string, meta?: any) => void;
  onTakeQuiz: (quizIdOrCode: string) => void;
  onOpenAuthModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onTakeQuiz, onOpenAuthModal }) => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [hubCount, setHubCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState<Quiz | null>(null);
  const [activeLiveModalQuiz, setActiveLiveModalQuiz] = useState<Quiz | null>(null);
  const [activeLeaderboardQuiz, setActiveLeaderboardQuiz] = useState<Quiz | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [creatorAccess, setCreatorAccess] = useState<CreatorAccessStatus | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';
  const isGuest = !user;

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [quizRes, hubRes] = await Promise.all([
        api.getQuizzes(),
        api.getHubs(),
      ]);
      setQuizzes(quizRes.quizzes || []);
      setHubCount(hubRes.hubs?.length || 0);

      if (isCreatorOrAdmin) {
        const expectedUserId = user?.id;
        api
          .getCreatorAccessStatus()
          .then((res) => {
            if (!res.userId || res.userId === expectedUserId) setCreatorAccess(res);
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCreatorAccess(null);
    loadDashboardData();
  }, [user?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Perform cascading quiz deletion with 404 verification
  const handleConfirmDelete = async () => {
    if (!deleteConfirmQuiz) return;
    const targetId = deleteConfirmQuiz.id;
    const targetTitle = deleteConfirmQuiz.title;

    try {
      setDeletingId(targetId);
      const res = await api.deleteQuiz(targetId);

      if (res.success) {
        // Remove from frontend state immediately
        setQuizzes((prev) => prev.filter((q) => q.id !== targetId));
        showToast(`Quiz "${targetTitle}" and all dependent attempts/sessions permanently deleted.`);
      }
    } catch (err: any) {
      console.error('Failed to delete quiz:', err);
      // Double check if it actually exists in backend
      try {
        await api.getQuiz(targetId);
        showToast(`Failed to delete quiz: ${err.message || 'Server error'}`);
      } catch (checkErr: any) {
        if (checkErr.status === 404) {
          // It was already deleted server-side; remove from frontend to prevent ghost quiz
          setQuizzes((prev) => prev.filter((q) => q.id !== targetId));
          showToast(`Quiz verified removed from database.`);
        }
      }
    } finally {
      setDeletingId(null);
      setDeleteConfirmQuiz(null);
    }
  };

  const copyQuizLink = (quiz: Quiz) => {
    const origin = window.location.origin;
    const fullUrl = `${origin}?quiz=${encodeURIComponent(quiz.shareCode)}`;
    navigator.clipboard.writeText(fullUrl);
    showToast(`Shareable link copied: ${quiz.shareCode}`);
  };

  // Aggregated metrics
  // Admin sees platform-wide totals; creators see only their own quizzes; students/guests see no totals
  const statQuizzes = user?.role === 'admin' ? quizzes : quizzes.filter((q) => q.creatorId === user?.id);
  // Creators see only their own quizzes in the list; admin sees all; students and visitors see public quizzes
  const listQuizzes = isCreatorOrAdmin ? statQuizzes : quizzes;
  const totalQuizzes = statQuizzes.length;
  const totalParticipants = statQuizzes.reduce((acc, q) => acc + (q.participantCount || 0), 0);
  const weightedScoreSum = statQuizzes.reduce((acc, q) => acc + (q.avgScore || 0) * (q.participantCount || 0), 0);
  const overallAvgScore = totalParticipants > 0 ? Math.round(weightedScoreSum / totalParticipants) : 0;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Expiry and remaining days calculations (Requirement 9)
  const creatorCode = user?.creatorCode || creatorAccess?.creatorCode || 'REM-CREATOR';
  const expiryDate = creatorAccess?.accessExpiresAt || undefined;
  const isAccessExpired =
    creatorAccess?.accessStatus === 'expired' ||
    (expiryDate ? new Date(expiryDate).getTime() < Date.now() : false);
  const remainingDays = expiryDate
    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          REQUIREMENT 8 & 9: CREATOR ACCESS STATUS & NOTIFICATIONS ON DASHBOARD
         ======================================================== */}
      {isCreatorOrAdmin && (
        <div className="space-y-4">
          {/* Requirement 8: When payment is enabled and creator is expired */}
          {creatorAccess?.paymentSystemEnabled && isAccessExpired && (
            <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950">
                    Your creator access has expired. Please renew your access to continue creating quizzes.
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Make a manual transfer to {creatorAccess.bankDetails.bankName} ({creatorAccess.bankDetails.accountNumber}) using your code <strong>{creatorCode}</strong> as payment reference.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>I Have Paid / Renew Access</span>
              </button>
            </div>
          )}

          {creatorAccess && !creatorAccess.paymentSystemEnabled && (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-xs">
              <span className="font-extrabold text-emerald-700">FREE</span>
              <span className="text-emerald-800">All creator tools are free right now</span>
            </div>
          )}

          {/* Requirement 9: Creator Profile/Dashboard Bar */}
          <div className={`bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${creatorAccess?.paymentSystemEnabled ? '' : 'hidden'}`}>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Creator Code Pill */}
              <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Creator Code:</span>
                <span className="font-mono font-black text-blue-300 text-xs tracking-wider">
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

              {/* Account Status */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Status:</span>
                <span
                  className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                    isAccessExpired
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : creatorAccess?.accessStatus === 'disabled'
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isAccessExpired ? 'Expired' : creatorAccess?.accessStatus || 'Active'}
                </span>
              </div>

              {creatorAccess?.accessStatus === 'trial' ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    Free trial:{' '}
                    <strong className="text-emerald-400 font-bold">
                      {Math.max(0, (creatorAccess.trialQuizzesAllowed ?? 0) - (creatorAccess.trialQuizzesUsed ?? 0))} of{' '}
                      {creatorAccess.trialQuizzesAllowed ?? 0} quizzes left
                    </strong>
                  </span>
                </div>
              ) : (
                <>
              {/* Expiry Date */}
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Expiry:{' '}
                  <strong className="font-mono text-white">
                    {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'Unlimited (Active)'}
                  </strong>
                </span>
              </div>

              {/* Remaining Days of Access */}
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Remaining:{' '}
                  <strong className={isAccessExpired ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {expiryDate
                      ? isAccessExpired
                        ? '0 Days (Expired)'
                        : `${remainingDays} Days Left`
                      : 'Unlimited'}
                  </strong>
                </span>
              </div>
                </>
              )}
            </div>

            {/* Upgrade / Renew Access Button if payment enabled */}
            {creatorAccess?.paymentSystemEnabled && (
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {creatorAccess.pendingRequest ? 'Verification Pending' : 'Upgrade / Renew Access'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-900/40 text-blue-300 border border-blue-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
            <span>{isGuest ? 'Public Quizzes' : isCreatorOrAdmin ? 'Creator Console' : 'Student Study Center'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            {isGuest ? 'Welcome to Remedi Pro' : `Welcome back, ${user?.fullName || 'Scholar'}`}
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {isGuest
              ? 'Take public quizzes or enter a quiz code. Create a free account to unlock creator tools: build quizzes, run mocks and track results.'
              : isCreatorOrAdmin
              ? 'Build multi-subject CBT examinations with real-time proctoring, custom score scales, passages, and instant leaderboard deployment.'
              : 'Sharpen your speed and subject mastery with time-calibrated CBT exams, comprehension passages, and diagnostic performance analytics.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            {isCreatorOrAdmin ? (
              <button
                onClick={() => onNavigate('create-quiz')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm shadow-blue-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Quiz</span>
              </button>
            ) : null}
            {isGuest && (
              <button
                onClick={() => onOpenAuthModal?.()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <span>Create account / Log in</span>
              </button>
            )}
            {!isGuest && <button
              onClick={() => onNavigate('learning-hub')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-700"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Explore Learning Hub</span>
            </button>}
          </div>
        </div>
      </div>

      {/* Metrics Row (Requirement 3: Total quizzes, Total participants, Average score, Learning Hub status) */}
      {isCreatorOrAdmin && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quizzes */}
        <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Quizzes</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileQuestion className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalQuizzes}</p>
          <p className="text-[11px] text-slate-500 mt-1">Active assessments in registry</p>
        </div>

        {/* Total Participants */}
        <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Participants</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalParticipants}</p>
          <p className="text-[11px] text-slate-500 mt-1">Verified examination attempts</p>
        </div>

        {/* Average Score */}
        <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Score</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{overallAvgScore}%</p>
          <p className="text-[11px] text-slate-500 mt-1">Aggregate cohort performance</p>
        </div>

        {/* Learning Hub Status */}
        <div className="p-4 md:p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Learning Hub Status</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {hubCount > 0 ? `${hubCount} Active` : 'Online'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Repository materials published</p>
        </div>
      </div>
      )}

      {/* Recent Quizzes Section (Requirement 3: Title, Subjects, Participants, Average score, Date, Actions) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Quizzes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Available multi-subject CBT examinations and live cohorts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh quiz table"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => onNavigate('my-quizzes')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View All Quizzes →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Loading educational assessments...
          </div>
        ) : listQuizzes.length === 0 ? (
          <div className="py-16 text-center">
            <FileQuestion className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No Quizzes Created Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by creating your first multi-subject CBT examination with custom timers and question banks.
            </p>
            {isCreatorOrAdmin && (
              <button
                onClick={() => onNavigate('create-quiz')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors inline-flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create First Quiz</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-5">Quiz Title</th>
                  <th className="py-3 px-4">Subjects</th>
                  <th className="py-3 px-4 text-center">Participants</th>
                  <th className="py-3 px-4 text-center">Avg Score</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listQuizzes.slice(0, 8).map((quiz) => {
                  const subjectList = quiz.subjects && quiz.subjects.length > 0
                    ? quiz.subjects.join(', ')
                    : 'General';

                  const dateStr = new Date(quiz.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <tr
                      key={quiz.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Quiz Title */}
                      <td className="py-3.5 px-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {quiz.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              [{quiz.shareCode}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {quiz.description || 'No description provided.'}
                          </p>
                        </div>
                      </td>

                      {/* Subjects */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 max-w-[180px] truncate">
                        {subjectList}
                      </td>

                      {/* Participants */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 tabular-nums">
                        {quiz.participantCount || 0}
                      </td>

                      {/* Average Score */}
                      <td className="py-3.5 px-4 text-center font-bold text-blue-700 tabular-nums">
                        {quiz.avgScore !== undefined && quiz.avgScore > 0 ? `${quiz.avgScore}%` : '—'}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Actions: Live Participants, Leaderboard, Edit, Delete (plus Take Test) */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Take Quiz Fast Action */}
                          <button
                            onClick={() => onTakeQuiz(quiz.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
                            title="Take this CBT exam"
                          >
                            Take Exam
                          </button>

                          {/* Live Participants Action */}
                          <button
                            onClick={() => setActiveLiveModalQuiz(quiz)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
                            title="View Live Participants"
                          >
                            <Radio className="w-4 h-4" />
                          </button>

                          {/* Leaderboard Action */}
                          <button
                            onClick={() => setActiveLeaderboardQuiz(quiz)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 rounded-md hover:bg-amber-50 transition-colors"
                            title="View Leaderboard"
                          >
                            <Trophy className="w-4 h-4" />
                          </button>

                          {/* Copy Link */}
                          <button
                            onClick={() => copyQuizLink(quiz)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                            title="Copy Shareable Quiz Link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          {/* Edit Action (if creator/admin) */}
                          {isCreatorOrAdmin && (
                            <button
                              onClick={() => onNavigate('create-quiz', { editQuizId: quiz.id })}
                              className="p-1.5 text-slate-600 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                              title="Edit Quiz"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Action (if creator/admin) */}
                          {isCreatorOrAdmin && (
                            <button
                              onClick={() => setDeleteConfirmQuiz(quiz)}
                              className="p-1.5 text-slate-600 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              title="Delete Quiz Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal (Requirement 3: Never leave a ghost quiz) */}
      {deleteConfirmQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Quiz Permanently?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              Deleting <strong>"{deleteConfirmQuiz.title}"</strong> will permanently purge:
              <br />· The quiz specification
              <br />· All questions and passages
              <br />· All participant attempts and scores
              <br />· Active live proctoring sessions
              <br />· Associated link codes
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmQuiz(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={deletingId !== null}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5"
                disabled={deletingId !== null}
              >
                {deletingId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deletingId ? 'Deleting...' : 'Delete Quiz'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Participants Modal */}
      {activeLiveModalQuiz && (
        <LiveParticipantsModal
          quizId={activeLiveModalQuiz.id}
          quizTitle={activeLiveModalQuiz.title}
          onClose={() => setActiveLiveModalQuiz(null)}
        />
      )}

      {/* Leaderboard Modal */}
      {activeLeaderboardQuiz && (
        <LeaderboardModal
          quizId={activeLeaderboardQuiz.id}
          quizTitle={activeLeaderboardQuiz.title}
          isCreatorOrAdmin={isCreatorOrAdmin}
          onClose={() => setActiveLeaderboardQuiz(null)}
        />
      )}

      {/* Creator Payment Modal */}
      {paymentModalOpen && (
        <CreatorPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentSubmitted={() => {
            loadDashboardData();
            showToast('Payment confirmation submitted. Awaiting manual admin verification.');
          }}
        />
      )}
    </div>
  );
};
