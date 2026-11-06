import React, { useEffect, useState } from 'react';
import { api, MyQuizProgress, QuizSubjectRow } from '../services/api.ts';

const verdictLabel: Record<QuizSubjectRow['verdict'], string> = {
  strong: 'Strong',
  average: 'Average',
  weak: 'Needs work',
  not_enough_data: 'No quizzes yet',
};

const verdictStyle: Record<QuizSubjectRow['verdict'], string> = {
  strong: 'bg-emerald-50 text-emerald-700',
  average: 'bg-blue-50 text-blue-700',
  weak: 'bg-rose-50 text-rose-700',
  not_enough_data: 'bg-slate-100 text-slate-600',
};

export const QuizResultsPanel: React.FC<{ hubId: string }> = ({ hubId }) => {
  const [data, setData] = useState<MyQuizProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyQuizProgress(hubId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Could not load quiz results.');
      });
    return () => {
      cancelled = true;
    };
  }, [hubId]);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-4">{error}</div>
    );
  }
  if (!data || data.subjects.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">My quiz results</p>

      {data.subjects.map((s) => (
        <div key={s.subject} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-extrabold text-slate-900">{s.subject}</p>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${verdictStyle[s.verdict]}`}>
              {verdictLabel[s.verdict]}
            </span>
          </div>

          {s.attempts === 0 ? (
            <p className="text-[11px] text-slate-500">Take a quiz in this subject and your result will show here.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-extrabold text-slate-900">{s.averagePct}%</p>
                  <p className="text-[10px] text-slate-500">Average</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-slate-900">{s.bestPct}%</p>
                  <p className="text-[10px] text-slate-500">Best</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-slate-900">{s.attempts}</p>
                  <p className="text-[10px] text-slate-500">Quizzes</p>
                </div>
              </div>

              <div className="space-y-1">
                {s.recent.map((r) => (
                  <p key={r.attemptId} className="text-xs text-slate-700 flex justify-between gap-2">
                    <span className="truncate">{r.quizTitle}</span>
                    <span className="font-bold shrink-0">{r.pct}%</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
