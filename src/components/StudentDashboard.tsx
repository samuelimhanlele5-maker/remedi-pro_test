import React, { useEffect, useState } from 'react';
import { api, MyProgress, SubjectProgress } from '../services/api.ts';
import { ChevronLeft, CheckCircle2, BookOpen } from 'lucide-react';

interface StudentDashboardProps {
  hub: { id: string; title: string };
  onBack: () => void;
  onStudy: () => void;
}

const verdictLabel: Record<SubjectProgress['verdict'], string> = {
  strong: 'Strong',
  average: 'Average',
  weak: 'Needs revision',
  not_enough_data: 'Not enough data yet',
};
const verdictStyle: Record<SubjectProgress['verdict'], string> = {
  strong: 'bg-emerald-50 text-emerald-700',
  average: 'bg-blue-50 text-blue-700',
  weak: 'bg-rose-50 text-rose-700',
  not_enough_data: 'bg-slate-100 text-slate-600',
};

const Bar: React.FC<{ pct: number; color?: string }> = ({ pct, color = 'bg-blue-600' }) => (
  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
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
    <div className="space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ChevronLeft className="w-4 h-4" /> {hub.title}
      </button>

      {loading ? (
        <p className="text-xs text-slate-500 text-center py-8">Loading your progress...</p>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-4">{error}</div>
      ) : data ? (
        <>
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
            <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wide">My progress</p>
            <div className="flex items-end justify-between">
              <p className="text-4xl font-extrabold">{data.overallProgressPct}%</p>
              <p className="text-xs text-slate-300 text-right">
                {data.topicsCompleted} of {data.topicsTotal} topics completed
              </p>
            </div>
            <Bar pct={data.overallProgressPct} color="bg-emerald-400" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              A topic is completed when you have read it and scored at least {data.passMark}% on its quiz, or it has no quiz.
            </p>
          </div>

          {data.topicsTotal === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No topics have been published for your subjects yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-emerald-200 p-4">
                  <p className="text-[11px] font-extrabold text-emerald-700">Strong subjects</p>
                  {data.strongSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">None yet</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {data.strongSubjects.map((s) => (
                        <li key={s} className="text-xs font-bold text-slate-900">
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-rose-200 p-4">
                  <p className="text-[11px] font-extrabold text-rose-700">Weak subjects</p>
                  {data.weakSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">None yet</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {data.weakSubjects.map((s) => (
                        <li key={s} className="text-xs font-bold text-slate-900">
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {data.strongSubjects.length === 0 && data.weakSubjects.length === 0 && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Strong and weak subjects appear after you take at least 2 topic quizzes in the same subject. Strong is an
                  average of 70% or more. Weak is below 50%.
                </p>
              )}

              {data.subjects.map((s) => (
                <div key={s.subject} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{s.subject}</p>
                      <p className="text-[11px] text-slate-500">
                        {s.topicsCompleted} of {s.topicsTotal} topics completed
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${verdictStyle[s.verdict]}`}>{verdictLabel[s.verdict]}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Progress</span>
                      <span className="font-bold">{s.progressPct}%</span>
                    </div>
                    <Bar pct={s.progressPct} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Average quiz score</span>
                      <span className="font-bold">{s.averageScorePct === null ? 'No quiz taken yet' : `${s.averageScorePct}%`}</span>
                    </div>
                    {s.averageScorePct !== null && (
                      <Bar pct={s.averageScorePct} color={s.averageScorePct >= 70 ? 'bg-emerald-500' : s.averageScorePct < 50 ? 'bg-rose-500' : 'bg-blue-600'} />
                    )}
                    <p className="text-[10px] text-slate-400">Based on {s.quizzesTaken} topic quiz{s.quizzesTaken === 1 ? '' : 'zes'}.</p>
                  </div>

                  {s.needsRevision.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1">
                      <p className="text-[11px] font-extrabold text-rose-700">Revise these topics</p>
                      {s.needsRevision.map((t) => (
                        <p key={t.topicId} className="text-xs text-slate-800">
                          {t.title} <span className="text-rose-600 font-bold">({t.bestPct}%)</span>
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    {s.topics.map((t) => (
                      <p key={t.topicId} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />}
                          <span className="truncate">{t.title}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">{t.bestPct !== null ? `${t.bestPct}%` : t.contentDone ? 'Read' : ''}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          <button onClick={onStudy} className="w-full px-4 py-3 text-xs font-bold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" /> Study topics
          </button>
        </>
      ) : null}
    </div>
  );
};
