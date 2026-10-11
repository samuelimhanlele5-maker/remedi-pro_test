import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { Quiz, Question, QuizAttempt } from '../types.ts';
import { CbtCalculator } from '../components/CbtCalculator.tsx';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Flag,
  Trophy,
  BookOpen,
  Eye,
  Award,
  Layers,
  Sparkles,
  Calculator as CalcIcon,
  ChevronRight,
  Maximize2,
  Minimize2,
  Type,
  Check,
  ListOrdered,
  X,
} from 'lucide-react';

interface CbtExamViewProps {
  quizIdOrCode: string;
  onExit: () => void;
  onViewLeaderboard: (quizId: string) => void;
}

type ExamState = 'gate' | 'subject_selection' | 'taking' | 'submitting' | 'result';

export const CbtExamView: React.FC<CbtExamViewProps> = ({
  quizIdOrCode,
  onExit,
  onViewLeaderboard,
}) => {
  const { user } = useAuth();

  // Loaded quiz & question bank
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Flow phase
  const [phase, setPhase] = useState<ExamState>('gate');

  // Participant Credentials
  const [participantName, setParticipantName] = useState(user?.fullName || '');
  const [participantEmail, setParticipantEmail] = useState(user?.email || '');
  const [gateError, setGateError] = useState<string | null>(null);
  const [priorAttempt, setPriorAttempt] = useState<QuizAttempt | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const isPrivate = quiz?.accessType === 'private';

  // Multi-Subject Selection
  const [selectedOptionalSubjects, setSelectedOptionalSubjects] = useState<string[]>([]);
  const [finalSelectedSubjects, setFinalSelectedSubjects] = useState<string[]>([]);

  // Filtered Exam Questions (Only student's selected subjects)
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  // INDEPENDENT SUBJECT NAVIGATION (Requirements 1, 2, 3)
  // Active subject name
  const [activeSubject, setActiveSubject] = useState<string>('');
  // Track last active question index per subject (e.g. { Chemistry: 2, Physics: 0 })
  const [subjectQuestionIndices, setSubjectQuestionIndices] = useState<Record<string, number>>({});

  // Reading Passage Display State (Requirement: Passage Display)
  const [passageFontSize, setPassageFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [passageCollapsedMobile, setPassageCollapsedMobile] = useState<boolean>(false);
  const [passageFullscreenModal, setPassageFullscreenModal] = useState<boolean>(false);
  const [expandedPassageDesktop, setExpandedPassageDesktop] = useState<boolean>(false);

  // Built-in Calculator
  const [calcOpen, setCalcOpen] = useState(false);

  // Timer: countdown persists across refresh, auto-submit on 0
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Final Result Attempt Record
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [showAnswerReview, setShowAnswerReview] = useState(false);
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<string>('all');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  // Load Quiz Data
  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoading(true);
        const res = await api.getQuiz(quizIdOrCode);
        setQuiz(res.quiz);

        if (user) {
          setParticipantName(user.fullName);
          setParticipantEmail(user.email);
        }
      } catch (err: any) {
        console.error('Error loading quiz for CBT:', err);
        setLoadError(err.message || 'Quiz not found or inactive.');
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizIdOrCode, user]);

  // Warn before closing the page or going back in the middle of an exam
  useEffect(() => {
    if (phase !== 'taking') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  // After a private quiz's questions arrive, continue into the exam
  const [pendingStart, setPendingStart] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    if (!pendingStart || !quiz || !(quiz.questions || []).some((q) => q.question)) return;
    const who = pendingStart;
    setPendingStart(null);
    const hasOptional = quiz.optionalSubjects && quiz.optionalSubjects.length > 0;
    const requiresPick = (quiz.requiredOptionalCount || 0) > 0;
    if (hasOptional && requiresPick) {
      setPhase('subject_selection');
    } else {
      startExamWithSubjects(quiz.subjects, who);
    }
  }, [pendingStart, quiz]);

  // Gate Check: verify one-attempt control with participant email
  const handleProceedFromGate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    if (!quiz) return;

    const priv = quiz.accessType === 'private';
    if (priv) {
      if (!accessCode.trim()) {
        setGateError('Please enter your exam code.');
        return;
      }
    } else if (!participantName.trim() || !participantEmail.trim()) {
      setGateError('Please enter both your Full Name and Gmail / Email address.');
      return;
    }

    try {
      let nameToUse = participantName.trim();
      let emailToUse = participantEmail.trim();
      let codeUsed = false;
      if (priv) {
        const v = await api.verifyCode(quiz.id, accessCode.trim());
        codeUsed = !!v.used;
        nameToUse = v.name;
        emailToUse = v.email;
        setParticipantName(v.name);
        setParticipantEmail(v.email);
      }
      const res = await api.checkAccess(quiz.id, emailToUse);

      if (res.canAttempt && res.schedule && res.schedule.status === 'upcoming') {
        setGateError(
          `This mock has not opened yet. It opens on ${new Date(res.schedule.opensAt || '').toLocaleString()}.`
        );
        return;
      }
      if (res.canAttempt && res.schedule && res.schedule.status === 'closed') {
        setGateError(`This mock is closed. It closed on ${new Date(res.schedule.closesAt || '').toLocaleString()}.`);
        return;
      }

      if (!res.canAttempt && res.priorAttempt) {
        setPriorAttempt(res.priorAttempt);
        setSubmittedAttempt(res.priorAttempt);
        setPhase('result');
        return;
      }

      if (codeUsed) {
        setGateError('This exam code has already been used.');
        return;
      }

      // Private quizzes: questions are only sent after the exam code is accepted
      if (priv) {
        const full = await api.getQuiz(quiz.id, accessCode.trim());
        setQuiz(full.quiz);
        setPendingStart({ name: nameToUse, email: emailToUse });
        return;
      }

      // Check if multi-subject elective selection is required
      const hasOptional = quiz.optionalSubjects && quiz.optionalSubjects.length > 0;
      const requiresPick = (quiz.requiredOptionalCount || 0) > 0;

      if (hasOptional && requiresPick) {
        setPhase('subject_selection');
      } else {
        const allSubs = quiz.subjects;
        startExamWithSubjects(allSubs, { name: nameToUse, email: emailToUse });
      }
    } catch (err: any) {
      setGateError(err.message || 'Failed to verify exam access.');
    }
  };

  // Start Exam once subjects are confirmed
  const startExamWithSubjects = async (chosenSubjects: string[], who?: { name: string; email: string }) => {
    const effName = who?.name ?? participantName;
    const effEmail = who?.email ?? participantEmail;
    if (!quiz) return;

    setFinalSelectedSubjects(chosenSubjects);

    // Filter questions only for the selected subjects
    const allQ = quiz.questions || [];
    const relevant = allQ.filter((q) => chosenSubjects.includes(q.subject));

    if (relevant.length === 0) {
      setGateError('The chosen subjects do not have any questions configured.');
      return;
    }

    setExamQuestions(relevant);
    const initialSubject = chosenSubjects[0] || 'General';
    setActiveSubject(initialSubject);

    // Initialize per-subject question indices to 0
    const initialIndices: Record<string, number> = {};
    chosenSubjects.forEach((sub) => {
      initialIndices[sub] = 0;
    });
    setSubjectQuestionIndices(initialIndices);

    const nowIso = new Date().toISOString();
    setStartedAt(nowIso);

    // Timer setup: check sessionStorage to prevent accidental reset on refresh
    const sessionKey = `remedi_timer_${quiz.id}_${effEmail.toLowerCase()}`;
    const durationSec = (quiz.durationMinutes || 0) * 60;

    if (quiz.durationMinutes) {
      const storedEndTime = sessionStorage.getItem(sessionKey);
      if (storedEndTime) {
        const remaining = Math.max(0, Math.floor((parseInt(storedEndTime, 10) - Date.now()) / 1000));
        setRemainingSeconds(remaining);
      } else {
        const endTime = Date.now() + durationSec * 1000;
        sessionStorage.setItem(sessionKey, String(endTime));
        setRemainingSeconds(durationSec);
      }
    } else {
      setRemainingSeconds(null);
    }

    // Register live session on server
    try {
      await api.startSession({
        quizId: quiz.id,
        participantName: effName.trim(),
        participantEmail: effEmail.trim(),
        selectedSubjects: chosenSubjects,
        accessCode: isPrivate ? accessCode.trim() : undefined,
      });
    } catch (e) {
      console.warn('Could not register live session:', e);
    }

    setPhase('taking');
  };

  // Current active subject & questions list
  const currentSubjectName = activeSubject || finalSelectedSubjects[0] || 'General';
  const currentSubjectQuestions = examQuestions.filter((q) => q.subject === currentSubjectName);
  const activeQuestionIndexInSubject = subjectQuestionIndices[currentSubjectName] || 0;
  const currentQuestion = currentSubjectQuestions[activeQuestionIndexInSubject] || currentSubjectQuestions[0];

  // Helper to change question index in the CURRENT subject
  const setCurrentSubjectQuestionIndex = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= currentSubjectQuestions.length) return;
    setSubjectQuestionIndices((prev) => ({
      ...prev,
      [currentSubjectName]: newIdx,
    }));
  };

  // Helper to switch to ANY subject immediately (Requirement 1)
  const handleSwitchSubject = (subjectName: string) => {
    if (!finalSelectedSubjects.includes(subjectName)) return;
    setActiveSubject(subjectName);
    // Ensure index exists for this subject (defaults to 0 or where student last was)
    if (subjectQuestionIndices[subjectName] === undefined) {
      setSubjectQuestionIndices((prev) => ({
        ...prev,
        [subjectName]: 0,
      }));
    }
  };

  // Heartbeat & Timer interval effect
  useEffect(() => {
    if (phase !== 'taking' || !quiz) return;

    // Timer countdown
    if (remainingSeconds !== null) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleFinalSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Heartbeat every 20s to update live progress for creator
    heartbeatRef.current = setInterval(() => {
      api.sendHeartbeat({
        quizId: quiz.id,
        participantEmail: participantEmail.trim(),
        currentQuestionIndex: (subjectQuestionIndices[currentSubjectName] || 0) + 1,
      }).catch(() => {});
    }, 20000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [phase, quiz, currentSubjectName, subjectQuestionIndices, answers, participantEmail]);

  // Handle Answer Selection
  const handleSelectOption = (option: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  // Toggle Flag
  const toggleFlagCurrent = () => {
    if (!currentQuestion) return;
    setFlagged((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // Navigation within the current subject (Requirement 3)
  const handleNextInSubject = () => {
    if (activeQuestionIndexInSubject < currentSubjectQuestions.length - 1) {
      // Advance to next question in this subject
      setCurrentSubjectQuestionIndex(activeQuestionIndexInSubject + 1);
    } else {
      // Reached the end of this subject:
      // Check if there are subsequent subjects in the exam
      const currentSubIdx = finalSelectedSubjects.indexOf(currentSubjectName);
      if (currentSubIdx < finalSelectedSubjects.length - 1) {
        // Can move to next subject
        const nextSubName = finalSelectedSubjects[currentSubIdx + 1];
        handleSwitchSubject(nextSubName);
      } else {
        // Last question of the last subject: open submit modal
        setSubmitConfirmOpen(true);
      }
    }
  };

  const handlePreviousInSubject = () => {
    if (activeQuestionIndexInSubject > 0) {
      setCurrentSubjectQuestionIndex(activeQuestionIndexInSubject - 1);
    } else {
      // At first question of current subject
      const currentSubIdx = finalSelectedSubjects.indexOf(currentSubjectName);
      if (currentSubIdx > 0) {
        const prevSubName = finalSelectedSubjects[currentSubIdx - 1];
        const prevSubQs = examQuestions.filter((q) => q.subject === prevSubName);
        setActiveSubject(prevSubName);
        setSubjectQuestionIndices((prev) => ({
          ...prev,
          [prevSubName]: Math.max(0, prevSubQs.length - 1),
        }));
      }
    }
  };

  // Submit Final Exam
  const handleFinalSubmit = async () => {
    if (!quiz) return;
    setSubmitConfirmOpen(false);
    setPhase('submitting');

    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    const totalTimeAllowed = (quiz.durationMinutes || 0) * 60;
    const timeUsed = remainingSeconds !== null
      ? Math.max(1, totalTimeAllowed - remainingSeconds)
      : Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

    try {
      const res = await api.submitAttempt({
        quizId: quiz.id,
        participantName: participantName.trim(),
        participantEmail: participantEmail.trim(),
        accessCode: isPrivate ? accessCode.trim() : undefined,
        userId: user?.id,
        selectedSubjects: finalSelectedSubjects,
        answers,
        timeUsedSeconds: timeUsed,
        startedAt,
      });

      const sessionKey = `remedi_timer_${quiz.id}_${participantEmail.toLowerCase()}`;
      sessionStorage.removeItem(sessionKey);

      setSubmittedAttempt(res.attempt);
      setPhase('result');
    } catch (err: any) {
      console.error('Submission error:', err);
      if (err.data?.attempt) {
        setSubmittedAttempt(err.data.attempt);
        setPhase('result');
      } else {
        alert(err.message || 'Error recording submission. Please check connection.');
        setPhase('taking');
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Initializing Remedi Pro CBT assessment engine...</p>
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="max-w-md mx-auto py-20 px-6 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Quiz Unavailable</h2>
        <p className="text-xs text-slate-600">{loadError || 'The requested quiz was not found.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ========================================================
  // PHASE 1: PARTICIPANT GATE
  // ========================================================
  if (phase === 'gate') {
    return (
      <div className="max-w-lg mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-900 text-white">
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
              Exam Code: {quiz.shareCode}
            </span>
            <h1 className="text-xl font-bold mt-2 leading-snug">{quiz.title}</h1>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
              {quiz.description || 'Computer-based assessment session.'}
            </p>

            {/* Subject preview cards */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Examination Subject Sections ({quiz.subjects.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quiz.subjects.map((sub) => {
                  const qCount = (quiz.questions || []).filter((q) => q.subject === sub).length;
                  return (
                    <span
                      key={sub}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-blue-300 border border-slate-700"
                    >
                      {sub} {qCount > 0 && <span className="opacity-75">({qCount} Qs)</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 tabular-nums">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>{quiz.durationMinutes ? `${quiz.durationMinutes} Minutes` : 'Untimed'}</span>
              </div>
              <div className="flex items-center gap-1.5 tabular-nums">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Score Scale: /{quiz.scoreScale}</span>
              </div>
              {quiz.calculatorEnabled !== false && (
                <div className="flex items-center gap-1.5">
                  <CalcIcon className="w-4 h-4 text-blue-400" />
                  <span>Calculator Available</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleProceedFromGate} className="p-6 space-y-4">
            {quiz?.opensAt && quiz?.closesAt && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Scheduled mock:</strong> open from {new Date(quiz.opensAt).toLocaleString()} to{' '}
                {new Date(quiz.closesAt).toLocaleString()}.
              </div>
            )}
            {isPrivate ? (
              <>
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <strong>Private exam:</strong> Enter the exam code you received when you registered. Each code works only once.
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Exam Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EX-7K3M9P"
                    autoCapitalize="characters"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
              </>
            ) : (
              <>
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
              <strong>Candidate Verification:</strong> Enter your full name and Gmail/Email to authenticate your CBT examination score and prevent duplicate entries.
            </div>

            {gateError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{gateError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Candidate Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="e.g. Samuel Osemu"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Candidate Email / Gmail <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
                placeholder="e.g. student@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Enter CBT Exam Session</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full mt-2 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to home
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ========================================================
  // PHASE 2: OPTIONAL ELECTIVE SELECTION (If configured by creator)
  // ========================================================
  if (phase === 'subject_selection') {
    const compulsory = quiz.compulsorySubjects || [];
    const optional = quiz.optionalSubjects || [];
    const requiredCount = quiz.requiredOptionalCount || 1;
    const canStart = selectedOptionalSubjects.length === requiredCount;

    const handleToggleOptional = (sub: string) => {
      if (selectedOptionalSubjects.includes(sub)) {
        setSelectedOptionalSubjects(selectedOptionalSubjects.filter((s) => s !== sub));
      } else {
        if (selectedOptionalSubjects.length < requiredCount) {
          setSelectedOptionalSubjects([...selectedOptionalSubjects, sub]);
        }
      }
    };

    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              CBT Subject Combination
            </span>
            <h1 className="text-lg font-bold text-slate-900 mt-1">
              Select Your Assessment Subjects
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Choose your required electives to customize your multi-subject assessment.
            </p>
          </div>

          {compulsory.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-2">
                Compulsory Subjects (Automatic)
              </h3>
              <div className="flex flex-wrap gap-2">
                {compulsory.map((sub) => (
                  <span
                    key={sub}
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>{sub}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800">
                Optional Electives (Select exactly {requiredCount})
              </h3>
              <span className="text-xs font-bold text-blue-600 tabular-nums">
                {selectedOptionalSubjects.length} / {requiredCount} selected
              </span>
            </div>

            <div className="space-y-2">
              {optional.map((sub) => {
                const isSelected = selectedOptionalSubjects.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleToggleOptional(sub)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all text-left ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{sub}</span>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                        isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              onClick={() => setPhase('gate')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Back
            </button>
            <button
              disabled={!canStart}
              onClick={() => {
                const combined = [...compulsory, ...selectedOptionalSubjects];
                startExamWithSubjects(combined);
              }}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Begin CBT Examination</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // PHASE 3: ACTIVE CBT EXAMINATION (Independent Subject Sections + Passage Display)
  // ========================================================
  if (phase === 'taking') {
    const totalQuestionsOverall = examQuestions.length;
    const answeredCountOverall = Object.keys(answers).length;
    const isAnswered = currentQuestion ? Boolean(answers[currentQuestion.id]) : false;
    const isFlagged = currentQuestion ? Boolean(flagged[currentQuestion.id]) : false;
    const currentSubjectAnsweredCount = currentSubjectQuestions.filter((q) => Boolean(answers[q.id])).length;

    // Font size classes for reading passage
    const passageFontClass =
      passageFontSize === 'sm'
        ? 'text-xs leading-relaxed'
        : passageFontSize === 'lg'
        ? 'text-base leading-loose'
        : 'text-sm leading-relaxed';

    return (
      <div className="max-w-6xl mx-auto space-y-4 pb-16 font-sans">
        {/* Sticky CBT Top Bar */}
        <div className="sticky top-16 z-30 bg-slate-900 text-white rounded-xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block truncate">
                {quiz.title}
              </span>
              <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-mono">
                Code: {quiz.shareCode}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-extrabold text-white">
                {currentSubjectName}
              </span>
              <span className="hidden sm:inline-block text-xs text-blue-300 font-mono font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                Question {activeQuestionIndexInSubject + 1} of {currentSubjectQuestions.length}
              </span>
            </div>
          </div>

          {/* Right Action Tools: Calculator, Timer, Submit */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {quiz.calculatorEnabled !== false && (
              <button
                type="button"
                onClick={() => setCalcOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                title="Open CBT Calculator"
              >
                <CalcIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Calculator</span>
              </button>
            )}

            {remainingSeconds !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-xs tabular-nums border ${
                  remainingSeconds < 180
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                    : 'bg-slate-800 text-white border-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            )}

            <button
              onClick={() => setSubmitConfirmOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors whitespace-nowrap"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* ========================================================
            REQUIREMENT 1: STUDENT MUST BE ABLE TO ACCESS EACH SUBJECT SEPARATELY
            - Display each subject clearly as an independent section
            - Click Chemistry -> enter Chemistry
            - Click Physics -> enter Physics
            - Click Biology -> enter Biology
            - Click English -> enter English
            - Start with any subject, no forced order!
           ======================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Subjects</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Total Progress: {answeredCountOverall}/{totalQuestionsOverall} answered
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {finalSelectedSubjects.map((sub) => {
              const subQ = examQuestions.filter((q) => q.subject === sub);
              const answeredInSub = subQ.filter((q) => Boolean(answers[q.id])).length;
              const isActive = sub === currentSubjectName;
              const isAllDone = answeredInSub === subQ.length && subQ.length > 0;

              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => handleSwitchSubject(sub)}
                  className={`px-3 py-2.5 rounded-xl text-left border transition-all flex flex-col justify-center relative group ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-blue-600 ring-offset-1'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold truncate">{sub}</span>
                    {isAllDone && !isActive ? (
                      <span className="text-emerald-600 font-bold text-xs" title="All questions answered">
                        ✓
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================
            MAIN CBT WORKSPACE:
            - If question has PASSAGE: Side-by-side split screen on desktop!
            - If NO passage: Clean full question presentation
            - Plus Question Navigator palette for this subject (1..N)
           ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Question + Passage Stage */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between min-h-[480px]">
              <div className="space-y-4">
                {/* Subject Header & Question Meta (Independent Numbering: Requirement 2) */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black uppercase tracking-wider">
                      {currentSubjectName}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Question {activeQuestionIndexInSubject + 1} of {currentSubjectQuestions.length}
                    </span>
                    {isAnswered && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Check className="w-3 h-3" /> Answered
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={toggleFlagCurrent}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      isFlagged
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span>{isFlagged ? 'Flagged' : 'Flag Question'}</span>
                  </button>
                </div>

                {/* ========================================================
                    REQUIREMENT: PASSAGE DISPLAY EDIT
                    - Rendered prominently and legibly
                    - Split pane or clean dedicated reading panel
                    - Font sizing controls (A- / A / A+)
                    - Expandable / Fullscreen modal for deep reading
                   ======================================================== */}
                {currentQuestion?.passage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-800" />
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                          Reading Comprehension Passage
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          (Applies to Question {activeQuestionIndexInSubject + 1})
                        </span>
                      </div>

                      {/* Reading tools: font size & expand */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPassageFontSize(passageFontSize === 'lg' ? 'base' : 'sm')}
                          className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-white text-slate-700 border border-amber-200 rounded hover:bg-amber-100"
                          title="Decrease text size"
                        >
                          A-
                        </button>
                        <button
                          type="button"
                          onClick={() => setPassageFontSize('base')}
                          className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-white text-slate-700 border border-amber-200 rounded hover:bg-amber-100"
                          title="Standard text size"
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => setPassageFontSize(passageFontSize === 'sm' ? 'base' : 'lg')}
                          className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-white text-slate-700 border border-amber-200 rounded hover:bg-amber-100"
                          title="Increase text size"
                        >
                          A+
                        </button>
                        <button
                          type="button"
                          onClick={() => setPassageFullscreenModal(true)}
                          className="p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded ml-1"
                          title="Open passage in fullscreen reading view"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Passage text with high legibility */}
                    <div className={`font-serif text-slate-800 max-h-64 overflow-y-auto pr-2 ${passageFontClass} whitespace-pre-line`}>
                      {currentQuestion.passage}
                    </div>
                  </div>
                )}

                {/* Reference Diagram (if present) */}
                {currentQuestion?.diagram && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <img
                      src={currentQuestion.diagram}
                      alt="Question Reference Diagram"
                      className="max-h-64 mx-auto rounded-lg object-contain shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-slate-500 font-medium block mt-1">
                      Figure: Examination Reference Diagram
                    </span>
                  </div>
                )}

                {/* Question Statement */}
                <div className="pt-1">
                  <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                    {currentQuestion?.question}
                  </p>
                </div>

                {/* Multiple Choice Options (A, B, C, D) */}
                <div className="space-y-2.5 pt-2">
                  {currentQuestion?.options?.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isChosen = answers[currentQuestion.id] === opt;

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-xs sm:text-sm font-medium text-left transition-all ${
                          isChosen
                            ? 'border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-500 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center shrink-0 text-xs transition-colors ${
                            isChosen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ========================================================
                  REQUIREMENT 3: STUDENT SHOULD BE ABLE TO NAVIGATE WITHIN EACH SUBJECT
                  - Previous: moves to previous question within this subject (disabled on Q1)
                  - Next: moves to next question within this subject
                  - Question jump palette (1..N) below
                 ======================================================== */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6 gap-2">
                <button
                  type="button"
                  disabled={activeQuestionIndexInSubject === 0}
                  onClick={handlePreviousInSubject}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5"
                  title={activeQuestionIndexInSubject === 0 ? 'First question in this subject' : 'Previous question'}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="text-center text-xs font-medium text-slate-500">
                  <span className="font-bold text-slate-800">
                    {currentSubjectName}: {activeQuestionIndexInSubject + 1}
                  </span>{' '}
                  of {currentSubjectQuestions.length}
                </div>

                <button
                  type="button"
                  onClick={handleNextInSubject}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>
                    {activeQuestionIndexInSubject === currentSubjectQuestions.length - 1
                      ? finalSelectedSubjects.indexOf(currentSubjectName) === finalSelectedSubjects.length - 1
                        ? 'Finish & Review'
                        : 'Next Subject'
                      : 'Next'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Question Number Palette (Numbered 1..N starting at 1 for THIS subject!) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    {currentSubjectName} Questions
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Numbered 1 to {currentSubjectQuestions.length}
                  </span>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {currentSubjectAnsweredCount}/{currentSubjectQuestions.length} Answered
                </span>
              </div>

              {/* Requirement 3: Question number navigation grid */}
              <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                {currentSubjectQuestions.map((q, idx) => {
                  const answered = Boolean(answers[q.id]);
                  const isCurrent = idx === activeQuestionIndexInSubject;
                  const flaggedItem = Boolean(flagged[q.id]);

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => setCurrentSubjectQuestionIndex(idx)}
                      className={`h-9 rounded-lg font-bold text-xs tabular-nums transition-all relative flex items-center justify-center ${
                        isCurrent ? 'ring-2 ring-blue-600 ring-offset-2 scale-105 z-10' : ''
                      } ${
                        answered
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={`Jump to Question ${idx + 1} (${answered ? 'Answered' : 'Unanswered'}${
                        flaggedItem ? ', Flagged' : ''
                      })`}
                    >
                      <span>{idx + 1}</span>
                      {flaggedItem && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Palette Legend */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-blue-600" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300" />
                  <span>Unanswered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border-2 border-blue-600" />
                  <span>Current Question</span>
                </div>
              </div>

              {/* Switch to Other Subjects List */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Switch Section:
                </span>
                <div className="space-y-1">
                  {finalSelectedSubjects.map((sub) => {
                    const isCurrent = sub === currentSubjectName;
                    const subQs = examQuestions.filter((q) => q.subject === sub);
                    const subAns = subQs.filter((q) => Boolean(answers[q.id])).length;

                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleSwitchSubject(sub)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isCurrent
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sub}</span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {subAns}/{subQs.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(true)}
                className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors mt-2"
              >
                Submit Entire Examination
              </button>
            </div>
          </div>
        </div>

        {/* Fullscreen Reading Passage Modal for Candidates */}
        {passageFullscreenModal && currentQuestion?.passage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {currentSubjectName} Reading Passage
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPassageFontSize(passageFontSize === 'lg' ? 'base' : 'sm')}
                    className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-white rounded"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassageFontSize('base')}
                    className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-white rounded"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassageFontSize(passageFontSize === 'sm' ? 'base' : 'lg')}
                    className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-white rounded"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassageFullscreenModal(false)}
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className={`p-6 overflow-y-auto font-serif text-slate-800 ${passageFontClass} whitespace-pre-line leading-relaxed`}>
                {currentQuestion.passage}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPassageFullscreenModal(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Return to Questions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Modal (Section-by-Section Breakdown) */}
        {submitConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Submit Entire Examination?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review your answered status across each independent subject section before submitting for final scoring:
              </p>

              {/* Subject Breakdown in Submit Modal */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                {finalSelectedSubjects.map((sub) => {
                  const subQs = examQuestions.filter((q) => q.subject === sub);
                  const answeredCount = subQs.filter((q) => Boolean(answers[q.id])).length;
                  const missingCount = subQs.length - answeredCount;

                  return (
                    <div key={sub} className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{sub}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">
                          {answeredCount}/{subQs.length} Answered
                        </span>
                        {missingCount > 0 && (
                          <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-bold">
                            {missingCount} left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalQuestionsOverall - answeredCountOverall > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Warning: You still have <strong>{totalQuestionsOverall - answeredCountOverall}</strong> unanswered questions overall.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitConfirmOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Return to Questions
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm"
                >
                  Confirm & Grade Exam
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Built-in CBT Calculator Modal */}
        <CbtCalculator isOpen={calcOpen} onClose={() => setCalcOpen(false)} />
      </div>
    );
  }

  // ========================================================
  // PHASE 4: SUBMITTING
  // ========================================================
  if (phase === 'submitting') {
    return (
      <div className="py-24 text-center space-y-3 font-sans">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Grading CBT Examination...</h2>
        <p className="text-xs text-slate-500">
          Calculating calibrated subject scores and generating diagnostic analysis
        </p>
      </div>
    );
  }

  // ========================================================
  // PHASE 5: RESULTS & SECTIONAL REVIEW
  // ========================================================
  if (phase === 'result' && submittedAttempt) {
    const minsUsed = Math.floor(submittedAttempt.timeUsedSeconds / 60);
    const secsUsed = submittedAttempt.timeUsedSeconds % 60;
    const timeUsedStr = `${minsUsed}m ${secsUsed}s`;

    // Filter review questions by chosen subject tab
    const reviewQuestions = (quiz.questions || []).filter((q) => {
      if (reviewSubjectFilter === 'all') return true;
      return q.subject === reviewSubjectFilter;
    });

    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6 font-sans">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Examination Result Report
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {quiz.title}
            </h1>
            <p className="text-xs text-slate-500">
              Candidate: <strong>{submittedAttempt.participantName}</strong> ({submittedAttempt.participantEmail})
            </p>
          </div>

          {/* Subject Performance Breakdown First */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Subject Results
            </h2>

            <div className="divide-y divide-slate-200">
              {Object.entries(submittedAttempt.subjectScores || {}).map(([subject, data]) => (
                <div key={subject} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-800">{subject}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                      {data.correct}/{data.total} Correct
                    </span>
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      {data.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OVERALL SCORE Banner */}
          <div className="p-6 rounded-xl bg-slate-900 text-white text-center space-y-1 border border-slate-800 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              OVERALL SCORE
            </span>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums">
              {submittedAttempt.formattedScore}
            </p>
          </div>

          {/* Detail metrics row (Correct, Wrong, Total questions, Time used) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-800 block">Correct Answers</span>
              <span className="text-lg font-bold text-emerald-900 tabular-nums">
                {submittedAttempt.correctCount}
              </span>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[11px] font-semibold text-rose-800 block">Wrong Answers</span>
              <span className="text-lg font-bold text-rose-900 tabular-nums">
                {submittedAttempt.wrongCount}
              </span>
            </div>

            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-700 block">Total Questions</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {submittedAttempt.totalQuestions}
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-semibold text-blue-800 block">Time Used</span>
              <span className="text-lg font-bold text-blue-900 tabular-nums">
                {timeUsedStr}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <span />

            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewLeaderboard(quiz.id)}
                className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trophy className="w-4 h-4 text-amber-600" />
                <span>Leaderboard</span>
              </button>
              <button
                onClick={onExit}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Answer Review Section by Subject */}
        {false && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Comprehensive Answer Key & Review
              </h2>

              {/* Filter review by subject */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setReviewSubjectFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    reviewSubjectFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Subjects
                </button>
                {quiz.subjects.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setReviewSubjectFilter(sub)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                      reviewSubjectFilter === sub
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {reviewQuestions.map((q, idx) => {
                const candidateChoice = submittedAttempt.answers[q.id];
                const isCorrect =
                  candidateChoice !== undefined &&
                  candidateChoice.trim().toLowerCase() === q.answer.trim().toLowerCase();

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      isCorrect ? 'bg-emerald-50/30 border-emerald-200' : 'bg-rose-50/30 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span className="font-bold">
                        {q.subject} — Item {idx + 1}
                      </span>
                      <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>

                    {q.passage && (
                      <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-slate-800 font-serif leading-relaxed">
                        <span className="text-[10px] uppercase font-sans font-bold text-amber-900 block mb-1">
                          Passage:
                        </span>
                        {q.passage}
                      </div>
                    )}

                    {q.diagram && (
                      <img
                        src={q.diagram}
                        alt="Question Diagram"
                        className="max-h-36 rounded object-contain border border-slate-200 p-1 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    <p className="font-semibold text-slate-900 text-xs sm:text-sm">{q.question}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = candidateChoice === opt;
                        const isActualKey = q.answer === opt;

                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                              isActualKey
                                ? 'bg-emerald-100/70 border-emerald-300 font-bold text-emerald-900'
                                : isSelected
                                ? 'bg-rose-100/70 border-rose-300 text-rose-900 line-through'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span>{opt}</span>
                            {isActualKey && (
                              <span className="text-[10px] uppercase font-bold text-emerald-700">
                                Correct Key
                              </span>
                            )}
                            {isSelected && !isActualKey && (
                              <span className="text-[10px] text-rose-600">Your Choice</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
