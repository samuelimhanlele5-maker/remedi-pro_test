import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { Quiz, Question, ScoreScale, CreatorAccessStatus } from '../types.ts';
import { NumericInput } from '../components/NumericInput.tsx';
import { CreatorPaymentModal } from '../components/CreatorPaymentModal.tsx';
import {
  Plus,
  Trash2,
  FileCode,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Award,
  Layers,
  Sparkles,
  Image as ImageIcon,
  Calculator as CalcIcon,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Edit,
  Eye,
  CreditCard,
  Building,
  AlertTriangle,
} from 'lucide-react';

interface CreateQuizViewProps {
  editQuizId?: string;
  onNavigate: (tab: string, meta?: any) => void;
  onQuizSaved: (quiz: Quiz) => void;
}

export interface SubjectSection {
  id: string;
  name: string;
  isCompulsory: boolean;
  inputMode: 'none' | 'bulk' | 'manual';
  questions: Partial<Question>[];
  bulkText: string;
  bulkFormat: 'json' | 'csv' | 'text';
  bulkError: string | null;
  bulkSuccess: string | null;
  expandedView: boolean;
}

export const CreateQuizView: React.FC<CreateQuizViewProps> = ({
  editQuizId,
  onNavigate,
  onQuizSaved,
}) => {
  const { user } = useAuth();

  // 1. Basic Quiz Information
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'private'>('public');
  const [maxAttempts, setMaxAttempts] = useState<number | ''>(1);
  const [opensAtLocal, setOpensAtLocal] = useState<string>('');
  const [windowHours, setWindowHours] = useState<number | ''>(24);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [calculatorEnabled, setCalculatorEnabled] = useState(true);

  // Score Scale: 100, 400, 500, 700, 7000 or custom
  const [scoreScalePreset, setScoreScalePreset] = useState<'100' | '400' | '500' | '700' | '7000' | 'custom'>('400');
  const [customScoreScale, setCustomScoreScale] = useState<number | null>(null);

  // Timer: 10, 20, 30, 50, 60 or custom
  const [timerPreset, setTimerPreset] = useState<'10' | '20' | '30' | '50' | '60' | 'custom'>('30');
  const [customDuration, setCustomDuration] = useState<number | null>(null);

  // 2. Subject Sections (Requirement 1 & 2: NO hardcoded predefined subjects!)
  const [sections, setSections] = useState<SubjectSection[]>([
    {
      id: `sec_${Date.now()}`,
      name: '',
      isCompulsory: true,
      inputMode: 'none',
      questions: [],
      bulkText: '',
      bulkFormat: 'json',
      bulkError: null,
      bulkSuccess: null,
      expandedView: true,
    },
  ]);

  // Subject Rules: required count for optional subjects
  const [requiredOptionalCount, setRequiredOptionalCount] = useState<number | null>(1);

  // Status
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [creatorAccess, setCreatorAccess] = useState<CreatorAccessStatus | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'creator' || user?.role === 'admin') {
      api.getCreatorAccessStatus()
        .then((res) => setCreatorAccess(res))
        .catch(() => {});
    }
  }, [user]);

  // Load existing quiz if in edit mode
  useEffect(() => {
    if (editQuizId) {
      api.getQuiz(editQuizId).then((res) => {
        const q = res.quiz;
        setTitle(q.title);
        setDescription(q.description || '');
        setAccessType(q.accessType);
        setMaxAttempts(q.maxAttempts ?? 1);
        setWindowHours(q.windowHours ?? 24);
        if (q.opensAt) {
          const d = new Date(q.opensAt);
          const pad = (n: number) => String(n).padStart(2, '0');
          setOpensAtLocal(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        } else {
          setOpensAtLocal('');
        }
        setLeaderboardEnabled(q.leaderboardEnabled);
        setCalculatorEnabled(q.calculatorEnabled !== false);

        // Timer
        if (q.durationMinutes) {
          if (['10', '20', '30', '50', '60'].includes(String(q.durationMinutes))) {
            setTimerPreset(String(q.durationMinutes) as any);
            setCustomDuration(null);
          } else {
            setTimerPreset('custom');
            setCustomDuration(q.durationMinutes);
          }
        } else {
          setTimerPreset('custom');
          setCustomDuration(null);
        }

        // Score scale
        if ([100, 400, 500, 700, 7000].includes(q.scoreScale)) {
          setScoreScalePreset(String(q.scoreScale) as any);
          setCustomScoreScale(null);
        } else {
          setScoreScalePreset('custom');
          setCustomScoreScale(q.scoreScale);
        }

        setRequiredOptionalCount(q.requiredOptionalCount || 1);

        // Reconstruct subject sections
        const reconstructed: SubjectSection[] = q.subjects.map((subName, idx) => {
          const subQuestions = (q.questions || []).filter((item) => item.subject === subName);
          const isComp = q.compulsorySubjects ? q.compulsorySubjects.includes(subName) : true;
          return {
            id: `sec_${idx}_${Date.now()}`,
            name: subName,
            isCompulsory: isComp,
            inputMode: 'none',
            questions: subQuestions,
            bulkText: '',
            bulkFormat: 'json',
            bulkError: null,
            bulkSuccess: null,
            expandedView: false,
          };
        });

        if (reconstructed.length > 0) {
          setSections(reconstructed);
        }
      }).catch((e) => {
        console.error('Error loading quiz for editing:', e);
      });
    }
  }, [editQuizId]);

  // Add a new Subject Section
  const handleAddSubject = () => {
    const newSec: SubjectSection = {
      id: `sec_${Date.now()}`,
      name: '',
      isCompulsory: sections.length === 0, // default first to compulsory
      inputMode: 'none',
      questions: [],
      bulkText: '',
      bulkFormat: 'json',
      bulkError: null,
      bulkSuccess: null,
      expandedView: true,
    };
    setSections([...sections, newSec]);
  };

  const handleRemoveSubject = (sectionId: string) => {
    if (sections.length <= 1) {
      alert('A quiz must have at least one subject section.');
      return;
    }
    setSections(sections.filter((s) => s.id !== sectionId));
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<SubjectSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
    );
  };

  // Bulk parser for a specific subject
  const handleProcessBulkImport = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    if (!section.bulkText.trim()) {
      handleUpdateSection(sectionId, { bulkError: 'Please paste questions text or JSON array.' });
      return;
    }

    try {
      let imported: Partial<Question>[] = [];

      if (section.bulkFormat === 'json') {
        const parsed = JSON.parse(section.bulkText);
        let rawItems: any[] = [];

        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            // Support grouped passage: { passage: "...", questions: [ { question, options, answer }, ... ] }
            if (item.passage && Array.isArray(item.questions)) {
              item.questions.forEach((subQ: any) => {
                rawItems.push({
                  ...subQ,
                  passage: subQ.passage || item.passage,
                });
              });
            } else {
              rawItems.push(item);
            }
          });
        } else if (parsed && Array.isArray(parsed.questions)) {
          // Top-level object with questions array and optional shared passage
          parsed.questions.forEach((subQ: any) => {
            rawItems.push({
              ...subQ,
              passage: subQ.passage || parsed.passage,
            });
          });
        } else {
          throw new Error('JSON data must be an array of question objects or passage groups.');
        }

        imported = rawItems.map((item, idx) => {
          if (!item.question || !String(item.question).trim()) {
            throw new Error(`Question item at index ${idx + 1} is missing "question" text.`);
          }
          return {
            id: `q_${Date.now()}_${idx}`,
            subject: section.name.trim() || 'General',
            passage: item.passage ? String(item.passage).trim() : undefined,
            question: String(item.question).trim(),
            diagram: item.diagram ? String(item.diagram).trim() : undefined,
            options: Array.isArray(item.options) && item.options.length > 0 ? item.options.map(String) : ['A', 'B', 'C', 'D'],
            answer: item.answer ? String(item.answer).trim() : (item.options ? String(item.options[0]) : 'A'),
            marks: item.marks ? Number(item.marks) : 1,
            order: section.questions.length + idx + 1,
          };
        });
      } else if (section.bulkFormat === 'csv') {
        const lines = section.bulkText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const startIndex = lines[0].toLowerCase().includes('question') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 5) {
            imported.push({
              id: `q_${Date.now()}_${i}`,
              subject: section.name.trim() || 'General',
              question: parts[0],
              options: [parts[1], parts[2], parts[3], parts[4]],
              answer: parts[5] || parts[1],
              passage: parts[6] || undefined,
              diagram: parts[7] || undefined,
              marks: 1,
              order: section.questions.length + imported.length + 1,
            });
          }
        }

        if (imported.length === 0) {
          throw new Error('No valid CSV rows parsed. Expected: Question,OptionA,OptionB,OptionC,OptionD,Answer,Passage,Diagram');
        }
      } else {
        // Simple text block parser
        const blocks = section.bulkText.split(/\n\s*\n/).filter((b) => b.trim());
        blocks.forEach((block, idx) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const questionText = lines[0].replace(/^\d+[\.\)]\s*/, '');
            const optionLines = lines.slice(1).filter((l) => /^[A-D][\.\)]/i.test(l) || l.startsWith('-'));
            const opts = optionLines.length >= 2
              ? optionLines.map((o) => o.replace(/^[A-D][\.\)]\s*|-\s*/i, ''))
              : ['Option A', 'Option B', 'Option C', 'Option D'];

            imported.push({
              id: `q_${Date.now()}_${idx}`,
              subject: section.name.trim() || 'General',
              question: questionText,
              options: opts,
              answer: opts[0],
              marks: 1,
              order: section.questions.length + imported.length + 1,
            });
          }
        });

        if (imported.length === 0) {
          throw new Error('Could not parse text blocks into questions.');
        }
      }

      const combinedQuestions = [...section.questions, ...imported];

      handleUpdateSection(sectionId, {
        questions: combinedQuestions,
        bulkText: '',
        bulkError: null,
        bulkSuccess: `Successfully added ${imported.length} questions to ${section.name || 'this subject'}. (Total: ${combinedQuestions.length})`,
        inputMode: 'none',
      });
    } catch (err: any) {
      handleUpdateSection(sectionId, { bulkError: err.message || 'Failed to parse questions.' });
    }
  };

  // Add individual question inside a subject
  const handleAddManualQuestion = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newQ: Partial<Question> = {
      id: `q_${Date.now()}`,
      subject: section.name.trim() || 'General',
      question: '',
      passage: '',
      diagram: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 'Option A',
      marks: 1,
      order: section.questions.length + 1,
    };

    handleUpdateSection(sectionId, {
      questions: [...section.questions, newQ],
    });
  };

  const handleUpdateManualQuestion = (sectionId: string, qIndex: number, field: keyof Question, value: any) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const updatedQ = [...section.questions];
    updatedQ[qIndex] = { ...updatedQ[qIndex], [field]: value };
    handleUpdateSection(sectionId, { questions: updatedQ });
  };

  const handleRemoveManualQuestion = (sectionId: string, qIndex: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const filtered = section.questions.filter((_, idx) => idx !== qIndex);
    handleUpdateSection(sectionId, { questions: filtered });
  };

  const handleDiagramUpload = (sectionId: string, qIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleUpdateManualQuestion(sectionId, qIndex, 'diagram', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleJson = (sectionId: string) => {
    const sample = [
      {
        question: "What is the atomic number of carbon?",
        options: ["4", "6", "8", "12"],
        answer: "6"
      },
      {
        question: "Which subatomic particle has a negative electrical charge?",
        options: ["Proton", "Neutron", "Electron", "Positron"],
        answer: "Electron"
      },
      {
        passage: "Reading comprehension requires systematic synthesis of lexical evidence.",
        question: "According to the passage, what does reading require?",
        options: ["Systematic synthesis of lexical evidence", "Passive memorization", "Physical conditioning", "Superficial reading"],
        answer: "Systematic synthesis of lexical evidence"
      }
    ];
    handleUpdateSection(sectionId, {
      bulkText: JSON.stringify(sample, null, 2),
      bulkFormat: 'json',
      bulkError: null,
    });
  };

  // Derived subjects and rules
  const optionalSections = sections.filter((s) => !s.isCompulsory);
  const compulsorySections = sections.filter((s) => s.isCompulsory);

  // Final Save Handler
  const handleSaveQuiz = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a quiz title.');
      return;
    }

    // Validate subjects
    const validSections = sections.filter((s) => s.name.trim().length > 0);
    if (validSections.length === 0) {
      setErrorMsg('Please define at least one subject with a valid name.');
      return;
    }

    // Check that at least one subject has questions
    const allQuestions: Question[] = [];
    validSections.forEach((sec) => {
      sec.questions.forEach((q, idx) => {
        if (q.question && q.question.trim()) {
          allQuestions.push({
            id: q.id || `q_${Date.now()}_${idx}`,
            subject: sec.name.trim(),
            passage: q.passage ? q.passage.trim() : undefined,
            question: q.question.trim(),
            diagram: q.diagram ? q.diagram.trim() : undefined,
            options: q.options && q.options.length > 0 ? q.options : ['A', 'B', 'C', 'D'],
            answer: q.answer ? String(q.answer).trim() : (q.options ? q.options[0] : 'A'),
            marks: q.marks || 1,
            order: idx + 1,
          });
        }
      });
    });

    if (allQuestions.length === 0) {
      setErrorMsg('Please add or import questions for at least one subject.');
      return;
    }

    // Determine final duration
    let finalDuration: number | null = null;
    if (timerPreset === 'custom') {
      finalDuration = customDuration;
    } else {
      finalDuration = parseInt(timerPreset, 10);
    }

    // Determine final score scale
    let finalScale: number = 400;
    if (scoreScalePreset === 'custom') {
      finalScale = customScoreScale && customScoreScale > 0 ? customScoreScale : 400;
    } else {
      finalScale = parseInt(scoreScalePreset, 10);
    }

    const subjectNames = validSections.map((s) => s.name.trim());
    const compulsoryNames = validSections.filter((s) => s.isCompulsory).map((s) => s.name.trim());
    const optionalNames = validSections.filter((s) => !s.isCompulsory).map((s) => s.name.trim());

    const payload = {
      creatorId: user?.id || 'usr_creator_1',
      creatorName: user?.fullName || 'Creator',
      title: title.trim(),
      description: description.trim(),
      subjects: subjectNames,
      compulsorySubjects: compulsoryNames,
      optionalSubjects: optionalNames,
      requiredOptionalCount: optionalNames.length > 0 ? (requiredOptionalCount ?? 1) : 0,
      durationMinutes: finalDuration,
      scoreScale: finalScale,
      accessType,
      maxAttempts: accessType === 'private' ? 1 : maxAttempts === '' ? 1 : maxAttempts,
      opensAt: opensAtLocal ? new Date(opensAtLocal).toISOString() : null,
      windowHours: windowHours === '' ? 24 : windowHours,
      leaderboardEnabled,
      calculatorEnabled,
      questions: allQuestions,
    };

    try {
      setSaving(true);
      let savedQuiz: Quiz;

      if (editQuizId) {
        const res = await api.updateQuiz(editQuizId, payload as any);
        savedQuiz = res.quiz;
        setSuccessMsg(`Quiz "${savedQuiz.title}" updated successfully.`);
      } else {
        const res = await api.createQuiz(payload as any);
        savedQuiz = res.quiz;
        setSuccessMsg(`Quiz published! Share Code: ${savedQuiz.shareCode}`);
      }

      onQuizSaved(savedQuiz);
      setTimeout(() => {
        onNavigate('my-quizzes');
      }, 1200);
    } catch (e: any) {
      console.error('Save quiz error:', e);
      setErrorMsg(e.message || 'Failed to save quiz.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Section-Based Assessment Builder
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">
            {editQuizId ? 'Edit CBT Examination' : 'Create CBT Examination'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build custom subject sections with dedicated bulk/manual question upload and JAMB-style navigation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('my-quizzes')}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveQuiz}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm shadow-blue-600/30 flex items-center gap-2"
          >
            {saving ? (
              <span>Saving Assessment...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>{editQuizId ? 'Update Quiz' : 'Create Quiz'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* REQUIREMENT 8: When payment is enabled and creator is expired */}
      {creatorAccess?.paymentSystemEnabled &&
        (creatorAccess.accessStatus === 'expired' || creatorAccess.accessStatus === 'disabled') && (
          <div className="p-6 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 shadow-xs space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-black text-rose-950">
                  Your creator access has expired. Please renew your access to continue creating quizzes.
                </h2>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Platform creator subscriptions are currently enforced. Transfer the renewal fee using your unique Creator Code as the payment reference.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/80 rounded-xl border border-rose-200 text-xs text-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Payment Details ({creatorAccess.currency} {creatorAccess.accessFeeAmount.toLocaleString()})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Bank:</span>
                  <strong>{creatorAccess.bankDetails.bankName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Account:</span>
                  <strong>{creatorAccess.bankDetails.accountNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Account Name:</span>
                  <strong>{creatorAccess.bankDetails.accountName}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 font-sans italic pt-1">
                {creatorAccess.bankDetails.instructions}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>I Have Paid (Submit Verification)</span>
              </button>
            </div>
          </div>
        )}

      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. BASIC INFORMATION (Requirement 1 & 2) */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span>Basic Information</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quiz Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. UTME Unified Mock Examination 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Instructions
            </label>
            <textarea
              rows={2}
              placeholder="Candidate instructions, exam rules, or curriculum syllabus notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time Limit */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Time Limit</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(['10', '20', '30', '50', '60'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTimerPreset(m);
                    setCustomDuration(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                    timerPreset === m
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTimerPreset('custom')}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                  timerPreset === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Custom
              </button>
            </div>

            {timerPreset === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <NumericInput
                  value={customDuration}
                  onChange={setCustomDuration}
                  placeholder="Minutes..."
                  min={1}
                  max={360}
                  className="w-28 bg-white"
                />
                <span className="text-xs text-slate-500">minutes (blank for untimed)</span>
              </div>
            )}
          </div>

          {/* Score Scale */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>Score Scale</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(['100', '400', '500', '700', '7000'] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => {
                    setScoreScalePreset(scale);
                    setCustomScoreScale(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                    scoreScalePreset === scale
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  /{scale}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setScoreScalePreset('custom')}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                  scoreScalePreset === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Custom
              </button>
            </div>

            {scoreScalePreset === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <NumericInput
                  value={customScoreScale}
                  onChange={setCustomScoreScale}
                  placeholder="e.g. 300"
                  min={10}
                  max={10000}
                  className="w-28 bg-white"
                />
                <span className="text-xs text-slate-500">maximum score scale</span>
              </div>
            )}
          </div>

          {/* Calculator and Access settings */}
          <div className="pt-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={calculatorEnabled}
                onChange={(e) => setCalculatorEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold flex items-center gap-1">
                <CalcIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Enable CBT On-screen Calculator</span>
              </span>
            </label>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <label className="block text-xs font-semibold text-slate-700 mr-2">Access Mode:</label>
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="access"
                checked={accessType === 'public'}
                onChange={() => setAccessType('public')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Public (anyone, name + email)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="access"
                checked={accessType === 'private'}
                onChange={() => setAccessType('private')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Private (registration + one-time code)</span>
            </label>
          </div>

          {accessType === 'public' ? (
            <div className="pt-2 flex items-center gap-3">
              <label className="block text-xs font-semibold text-slate-700 mr-2">Attempts per email:</label>
              <input
                type="number"
                min={0}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="text-[11px] text-slate-500">0 = unlimited</span>
            </div>
          ) : (
            <p className="pt-2 text-[11px] text-slate-500 leading-relaxed">
              Students register through a link you send them, get an exam code, and each code works once.
              After saving, open <strong>My Quizzes</strong> and tap the registrations icon to get the link.
            </p>
          )}


          <div className="pt-3 border-t border-slate-100 mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Schedule (optional)</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={opensAtLocal}
                onChange={(e) => setOpensAtLocal(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="text-[11px] text-slate-500">open for</span>
              <input
                type="number"
                min={1}
                value={windowHours}
                onChange={(e) => setWindowHours(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="text-[11px] text-slate-500">hours</span>
              {opensAtLocal && (
                <button
                  type="button"
                  onClick={() => setOpensAtLocal('')}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Students can only start between the opening time and closing time. Leave empty for a quiz that is always
              open. To extend a mock, edit the quiz and change the opening time or hours.
            </p>
          </div>
        </div>
      </section>

      {/* 2. SUBJECT SECTIONS (Requirement 2, 3, 4, 5, 8, 9) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Subject Sections ({sections.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add any subjects (e.g. Chemistry, Physics, Biology, Use of English, Economics, Government). Each subject maintains its independent question bank and 1–N numbering.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddSubject}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Subject</span>
          </button>
        </div>

        {/* List of Subject Sections */}
        <div className="space-y-5">
          {sections.map((section, secIdx) => {
            const questionCount = section.questions.length;

            return (
              <div
                key={section.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Subject Header Card */}
                <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {secIdx + 1}
                    </span>
                    <div className="flex-1 max-w-sm">
                      <input
                        type="text"
                        placeholder="Subject Name (e.g. Chemistry, Economics, English)..."
                        value={section.name}
                        onChange={(e) => handleUpdateSection(section.id, { name: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 tabular-nums">
                        {questionCount} {questionCount === 1 ? 'Question' : 'Questions'}
                        {questionCount > 0 && ` (1–${questionCount})`}
                      </span>
                    </div>
                  </div>

                  {/* Compulsory vs Optional Selector & Actions */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => handleUpdateSection(section.id, { isCompulsory: true })}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          section.isCompulsory
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Compulsory
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSection(section.id, { isCompulsory: false })}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          !section.isCompulsory
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Optional
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateSection(section.id, { expandedView: !section.expandedView })}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                      title={section.expandedView ? 'Collapse section' : 'Expand section'}
                    >
                      {section.expandedView ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(section.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Remove Subject Section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subject Body (Clean question input area underneath that subject) */}
                {section.expandedView && (
                  <div className="p-5 space-y-4">
                    {section.bulkSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                        <span>{section.bulkSuccess}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateSection(section.id, { bulkSuccess: null })}
                          className="text-emerald-600 font-bold ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Selector: How do you want to add questions? (Requirement 3, 4, 5, 16) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Add Questions to {section.name || 'this Subject'}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Choose whether to paste a bulk set or author questions one by one.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSection(section.id, {
                              inputMode: section.inputMode === 'bulk' ? 'none' : 'bulk',
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            section.inputMode === 'bulk'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Bulk Import
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const newMode = section.inputMode === 'manual' ? 'none' : 'manual';
                            handleUpdateSection(section.id, { inputMode: newMode });
                            if (newMode === 'manual' && section.questions.length === 0) {
                              handleAddManualQuestion(section.id);
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            section.inputMode === 'manual'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Add One by One
                        </button>
                      </div>
                    </div>

                    {/* Mode A: BULK IMPORT (Requirement 4) */}
                    {section.inputMode === 'bulk' && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-blue-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                            <Upload className="w-4 h-4 text-blue-600" />
                            <span>Bulk Upload for {section.name || 'Subject'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => loadSampleJson(section.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Load Sample JSON
                            </button>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <label className="cursor-pointer">
                                <input
                                  type="radio"
                                  name={`fmt_${section.id}`}
                                  checked={section.bulkFormat === 'json'}
                                  onChange={() => handleUpdateSection(section.id, { bulkFormat: 'json' })}
                                  className="mr-1 text-blue-600"
                                />
                                JSON
                              </label>
                              <label className="cursor-pointer ml-1">
                                <input
                                  type="radio"
                                  name={`fmt_${section.id}`}
                                  checked={section.bulkFormat === 'csv'}
                                  onChange={() => handleUpdateSection(section.id, { bulkFormat: 'csv' })}
                                  className="mr-1 text-blue-600"
                                />
                                CSV
                              </label>
                              <label className="cursor-pointer ml-1">
                                <input
                                  type="radio"
                                  name={`fmt_${section.id}`}
                                  checked={section.bulkFormat === 'text'}
                                  onChange={() => handleUpdateSection(section.id, { bulkFormat: 'text' })}
                                  className="mr-1 text-blue-600"
                                />
                                Text
                              </label>
                            </div>
                          </div>
                        </div>

                        {section.bulkError && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{section.bulkError}</span>
                          </div>
                        )}

                        <textarea
                          rows={6}
                          placeholder={
                            section.bulkFormat === 'json'
                              ? '[\n  {\n    "question": "What is the atomic number of carbon?",\n    "options": ["4", "6", "8", "12"],\n    "answer": "6"\n  }\n]'
                              : 'Question,OptionA,OptionB,OptionC,OptionD,Answer,Passage,Diagram'
                          }
                          value={section.bulkText}
                          onChange={(e) => handleUpdateSection(section.id, { bulkText: e.target.value })}
                          className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            Supports passages, diagrams, and options. Attached only to {section.name || 'this subject'}.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleProcessBulkImport(section.id)}
                            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs"
                          >
                            Parse & Attach Questions
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mode B: ADD ONE BY ONE (Requirement 5) */}
                    {section.inputMode === 'manual' && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Questions in {section.name || 'Subject'} ({section.questions.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddManualQuestion(section.id)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Another Question</span>
                          </button>
                        </div>

                        {section.questions.length === 0 ? (
                          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                            No questions yet. Click "+ Add Another Question" or switch to "Bulk Import".
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {section.questions.map((q, qIdx) => (
                              <div
                                key={q.id || qIdx}
                                className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                      {qIdx + 1}
                                    </span>
                                    <span>Question {qIdx + 1}</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManualQuestion(section.id, qIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                    title="Delete question"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Optional Passage (Requirement 6) */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-semibold text-slate-600">
                                      Passage / Reading Material (Optional)
                                    </label>
                                    {qIdx > 0 && !q.passage && section.questions.some((prevQ, pIdx) => pIdx < qIdx && Boolean(prevQ.passage)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Find closest previous passage
                                          const prevWithPassage = [...section.questions]
                                            .slice(0, qIdx)
                                            .reverse()
                                            .find((item) => Boolean(item.passage));
                                          if (prevWithPassage?.passage) {
                                            handleUpdateManualQuestion(section.id, qIdx, 'passage', prevWithPassage.passage);
                                          }
                                        }}
                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                                      >
                                        + Copy passage from previous question
                                      </button>
                                    )}
                                  </div>
                                  <textarea
                                    rows={2}
                                    placeholder="Enter reading comprehension text, scientific scenario, or case (leave blank if none)..."
                                    value={q.passage || ''}
                                    onChange={(e) =>
                                      handleUpdateManualQuestion(section.id, qIdx, 'passage', e.target.value)
                                    }
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-serif"
                                  />
                                </div>

                                {/* Optional Diagram / Image (Requirement 7) */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Diagram / Image Reference (Optional)</span>
                                    </label>
                                    <label className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer">
                                      <span>Upload Image</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleDiagramUpload(section.id, qIdx, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Image URL or Base64 data..."
                                    value={q.diagram || ''}
                                    onChange={(e) =>
                                      handleUpdateManualQuestion(section.id, qIdx, 'diagram', e.target.value)
                                    }
                                    className="w-full px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                                  />
                                  {q.diagram && (
                                    <img
                                      src={q.diagram}
                                      alt="Diagram Preview"
                                      className="max-h-24 rounded object-contain mt-1.5 border border-slate-200 p-1"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                </div>

                                {/* Question Text */}
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    Question Text <span className="text-rose-500">*</span>
                                  </label>
                                  <textarea
                                    rows={2}
                                    required
                                    placeholder="Enter question statement..."
                                    value={q.question || ''}
                                    onChange={(e) =>
                                      handleUpdateManualQuestion(section.id, qIdx, 'question', e.target.value)
                                    }
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                                  />
                                </div>

                                {/* Options & Answer Selector */}
                                <div className="space-y-1.5">
                                  <label className="block text-[11px] font-semibold text-slate-700">
                                    Options (Select radio for correct answer)
                                  </label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {(q.options || ['A', 'B', 'C', 'D']).map((opt, optIdx) => {
                                      const letter = String.fromCharCode(65 + optIdx);
                                      const isCorrect = q.answer === opt;

                                      return (
                                        <div
                                          key={optIdx}
                                          className={`flex items-center gap-2 p-1.5 rounded-lg border bg-white ${
                                            isCorrect ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`ans_${section.id}_${qIdx}`}
                                            checked={isCorrect}
                                            onChange={() =>
                                              handleUpdateManualQuestion(section.id, qIdx, 'answer', opt)
                                            }
                                            className="text-emerald-600 focus:ring-emerald-500 ml-1"
                                          />
                                          <span className="font-bold text-xs text-slate-400 w-4 text-center">
                                            {letter}
                                          </span>
                                          <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                              const newOpts = [...(q.options || [])];
                                              newOpts[optIdx] = e.target.value;
                                              handleUpdateManualQuestion(section.id, qIdx, 'options', newOpts);
                                            }}
                                            placeholder={`Option ${letter}`}
                                            className="flex-1 text-xs bg-transparent border-0 focus:outline-none"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => handleAddManualQuestion(section.id)}
                              className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-400 text-xs font-semibold text-blue-600 rounded-xl transition-colors text-center"
                            >
                              + Add Another Question to {section.name || 'this Subject'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview summary when questions exist and not in active input mode */}
                    {section.inputMode === 'none' && section.questions.length > 0 && (
                      <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                        <span className="text-slate-700">
                          <strong>{section.questions.length}</strong> questions registered for{' '}
                          <strong>{section.name || 'this subject'}</strong> (Numbered 1–
                          {section.questions.length}).
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateSection(section.id, { inputMode: 'manual' })}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Review / Edit
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateSection(section.id, { inputMode: 'bulk' })}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            + Import More
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. SUBJECT RULES & ELECTIVES (Requirement 8) */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>Subject Rules & Candidate Electives</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              Compulsory Subjects ({compulsorySections.length})
            </span>
            <p className="text-[11px] text-slate-500">
              Automatically locked and completed by every candidate.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {compulsorySections.map((s) => (
                <span
                  key={s.id}
                  className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold"
                >
                  {s.name || 'Unnamed Subject'} ★
                </span>
              ))}
              {compulsorySections.length === 0 && (
                <span className="text-xs text-slate-400">No compulsory subjects designated.</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              Optional Electives ({optionalSections.length})
            </span>
            <p className="text-[11px] text-slate-500">
              {optionalSections.length > 0
                ? 'Candidate chooses their subject combination before starting the exam.'
                : 'All subjects are marked compulsory.'}
            </p>

            {optionalSections.length > 0 && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">
                  Student must select:
                </span>
                <NumericInput
                  value={requiredOptionalCount}
                  onChange={setRequiredOptionalCount}
                  min={1}
                  max={optionalSections.length}
                  className="w-20 bg-white"
                />
                <span className="text-xs text-slate-600">
                  of {optionalSections.length} optional subjects
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Publish Bar */}
      <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <span className="text-xs text-slate-500">
          Ready to deploy? The examination link will persist server-side and support live monitoring.
        </span>
        <button
          onClick={handleSaveQuiz}
          disabled={saving}
          className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors flex items-center gap-2"
        >
          {saving ? 'Saving...' : editQuizId ? 'Update Examination' : 'Publish Examination'}
        </button>
      </div>

      {paymentModalOpen && (
        <CreatorPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentSubmitted={() => {
            api.getCreatorAccessStatus().then(setCreatorAccess);
          }}
        />
      )}
    </div>
  );
};
