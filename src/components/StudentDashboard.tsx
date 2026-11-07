import React, { useEffect, useState } from 'react';
import { api, MyProgress, SubjectProgress } from '../services/api.ts';
import { ChevronLeft, CheckCircle2, BookOpen, Atom, Zap, Waves, Sprout, Trophy, Sparkles } from 'lucide-react';
import { QuizResultsPanel } from './QuizResultsPanel.tsx';

interface StudentDashboardProps {
  hub: { id: string; title: string };
  onBack: () => void;
  onStudy: () => void;
}

// Gentle, encouraging wording instead of harsh labels
const verdictLabel: Record<SubjectProgress['verdict'], string> = {
  strong: 'Going well',
  average: 'Getting there',
  weak: 'Worth a revisit',
  not_enough_data: 'Just starting',
};
const verdictStyle: Record<SubjectProgress['verdict'], string> = {
  strong: 'bg-emerald-50 text-emerald-700',
  average: 'bg-blue-50 text-blue-700',
  weak: 'bg-amber-50 text-amber-700',
  not_enough_data: 'bg-slate-100 text-slate-600',
};

// Each subject gets its own icon and colour, so the list feels lively
const subjectStyles = [
  { icon: Atom, tint: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  { icon: Zap, tint: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  { icon: Waves, tint: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500' },
  { icon: Sprout, tint: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
];

const encouragement = (pct: number) => {
  if (pct >= 80) return 'Brilliant progress. Keep the rhythm going.';
  if (pct >= 40) return 'You are building steady momentum.';
  if (pct > 0) return 'Nice start. One topic at a time.';
  return 'Pick a topic and take the first step today.';
};

// Circular progress ring for the overall score
const Ring: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${clamped}% complete`}>
      <circle cx="52" cy="52" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-100" />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
        transform="rotate(-90 52 52)"
        className="text-emerald-500 transition-all duration-700"
      />
      <text x="52" y="58" textAnchor="middle" className="fill-slate-900 text-[20px] font-bold">
        {clamped}%
      </text>
    </svg>
  );
};

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
    <div
      className={`h-full rounded-full ${color} transition-all duration-700`}
      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
    />
  </div>
);

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ hub, onBack, onStudy }) => {
  const [data, setData] = useState<MyProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.getMyProgress(hub.id));
      } catch (e: any) {
        setError(e.message || 'Could not load your progress.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-1">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ChevronLeft className="w-4 h-4" /> {hub.title}
      </button>

      {loading ? (
        <p className="text-xs text-slate-500 text-center py-8">Loading your progress...</p>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-4">{error}</div>
      ) : data ? (
        <>
          {/* Overall progress */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="text-slate-900 shrink-0">
              <Ring pct={data.overallProgressPct} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-slate-500">Your progress</p>
              <p className="text-sm font-bold text-slate-900">
                {data.topicsCompleted} of {data.topicsTotal} topics done
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{encouragement(data.overallProgressPct)}</p>
            </div>
          </div>

          {data.topicsTotal === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No topics have been published for your subjects yet.
            </div>
          ) : (
            <>
              {/* Strengths and areas to revisit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <Trophy className="w-4 h-4" />
                    <p className="text-[11px] font-semibold">Going well</p>
                  </div>
                  {data.strongSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-600">Your strengths will show here.</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.strongSubjects.map((s) => (
                        <li key={s} className="text-xs font-semibold text-slate-900">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-amber-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-[11px] font-semibold">Worth a revisit</p>
                  </div>
                  {data.weakSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-600">Nothing to revisit. Well done.</p>
                  ) : (
                    <ul className="space-y-1">
                      {data.weakSubjects.map((s) => (
                        <li key={s} className="text-xs font-semibold text-slate-900">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* One card per subject */}
              {data.subjects.map((s, i) => {
                const style = subjectStyles[i % subjectStyles.length];
                const Icon = style.icon;
                return (
                  <div key={s.subject} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.tint}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{s.subject}</p>
                        <p className="text-[11px] text-slate-500">
                          {s.topicsCompleted} of {s.topicsTotal} topics
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${verdictStyle[s.verdict]}`}>
                        {verdictLabel[s.verdict]}
                      </span>
                    </div>

                    <Bar pct={s.progressPct} color={style.bar} />
                    <p className="text-[11px] text-slate-500">
                      {s.progressPct}% complete
                      {s.averageScorePct !== null && ` · average quiz score ${s.averageScorePct}%`}
                    </p>

                    {s.needsRevision.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 space-y-1">
                        <p className="text-[11px] font-semibold text-amber-700">Revisit these next</p>
                        {s.needsRevision.map((t) => (
                          <p key={t.topicId} className="text-xs text-slate-800">
                            {t.title} <span className="text-amber-700 font-semibold">({t.bestPct}%)</span>
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      {s.topics.map((t) => (
                        <p key={t.topicId} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            {t.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{t.title}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {t.bestPct !== null ? `${t.bestPct}%` : t.contentDone ? 'Read' : ''}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <QuizResultsPanel hubId={hub.id} />

          <button
            onClick={onStudy}
            className="w-full px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition-all rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            <BookOpen className="w-4 h-4" /> Continue studying
          </button>
        </>
      ) : null}
    </div>
  );
};
