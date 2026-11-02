import React, { useEffect, useState } from 'react';
import { api, TopicFull, TopicQuizResult, TopicSummary } from '../services/api.ts';
import { ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';

interface TopicReaderProps {
  hub: { id: string; title: string };
  onBack: () => void;
}

export const TopicReader: React.FC<TopicReaderProps> = ({ hub, onBack }) => {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<TopicFull | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TopicQuizResult | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const say = (text: string, bad = false) => {
    setMsg({ text, bad });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadList = async () => {
    try {
      setLoading(true);
      const res = await api.getTopics(hub.id);
      setTopics(res.topics || []);
    } catch (e: any) {
      say(e.message || 'Could not load topics.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const openTopic = async (id: string) => {
    try {
      const res = await api.getTopic(hub.id, id);
      setTopic(res.topic);
      setAnswers({});
      setResult(null);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      say(e.message || 'Could not open this topic.', true);
    }
  };

  const reloadTopic = async () => {
    if (topic) {
      const res = await api.getTopic(hub.id, topic.id);
      setTopic(res.topic);
    }
  };

  const finishReading = async () => {
    if (!topic) return;
    setBusy(true);
    try {
      await api.completeTopic(hub.id, topic.id);
      await reloadTopic();
      say(topic.quiz.length ? 'Great. The quiz is open now.' : 'Topic completed.');
    } catch (e: any) {
      say(e.message || 'Could not save your progress.', true);
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = async () => {
    if (!topic) return;
    const unanswered = topic.quiz.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will count as wrong. Submit anyway?`)) return;
    setBusy(true);
    try {
      const res = await api.submitTopicQuiz(hub.id, topic.id, answers);
      setResult(res);
      await reloadTopic();
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      say(e.message || 'Could not submit the quiz.', true);
    } finally {
      setBusy(false);
    }
  };

  const bySubject: Record<string, TopicSummary[]> = {};
  topics.forEach((t) => {
    (bySubject[t.subject] = bySubject[t.subject] || []).push(t);
  });

  const btn = 'px-4 py-2.5 text-xs font-bold rounded-xl';
  const prog = topic?.myProgress;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {msg && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg ${msg.bad ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
          {msg.text}
        </div>
      )}

      <button
        onClick={
          topic
            ? () => {
                setTopic(null);
                setResult(null);
                loadList();
              }
            : onBack
        }
        className="flex items-center gap-1 text-xs font-semibold text-blue-600"
      >
        <ChevronLeft className="w-4 h-4" /> {topic ? 'All topics' : hub.title}
      </button>

      {!topic ? (
        loading ? (
          <p className="text-xs text-slate-500 text-center py-8">Loading topics...</p>
        ) : topics.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No topics have been published yet for your subjects. Check back soon.
          </div>
        ) : (
          Object.keys(bySubject).map((subject) => (
            <div key={subject} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-extrabold text-slate-900">{subject}</p>
              {bySubject[subject].map((t) => (
                <button key={t.id} onClick={() => openTopic(t.id)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900 truncate">{t.title}</span>
                    <span className="block text-[11px] text-slate-500">
                      {t.quizCount > 0 ? `${t.quizCount} quiz questions` : 'No quiz'}
                      {t.myProgress?.bestPct !== null && t.myProgress?.bestPct !== undefined ? ` · best ${t.myProgress.bestPct}%` : ''}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      t.myProgress?.completed ? 'bg-emerald-50 text-emerald-700' : t.myProgress?.contentDone ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.myProgress?.completed ? 'Done' : t.myProgress?.contentDone ? 'Read' : 'New'}
                  </span>
                </button>
              ))}
            </div>
          ))
        )
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold text-slate-500">{topic.subject}</p>
            <h2 className="text-base font-extrabold text-slate-900">{topic.title}</h2>
          </div>

          {/* The topic content, in the creator's order */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            {topic.blocks.map((b, i) => (
              <div key={b.id || i} className="space-y-1.5">
                {b.type === 'text' && <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">{b.text}</p>}
                {b.type === 'image' && b.url && <img src={b.url} alt={b.caption || ''} loading="lazy" className="max-w-full rounded-xl" />}
                {b.type === 'audio' && b.url && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">Voice note</p>
                    <audio controls preload="none" src={b.url} className="w-full" />
                  </div>
                )}
                {b.type === 'video' && b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer" className="inline-block px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg">
                    Watch the video
                  </a>
                )}
                {b.caption && b.type !== 'text' && <p className="text-[11px] text-slate-500">{b.caption}</p>}
              </div>
            ))}
          </div>

          {!prog?.contentDone ? (
            <button onClick={finishReading} disabled={busy} className={`${btn} w-full bg-blue-600 text-white disabled:opacity-60`}>
              {busy ? 'Saving...' : topic.quiz.length ? 'I have finished reading. Open the quiz' : 'I have finished this topic'}
            </button>
          ) : topic.quiz.length === 0 ? (
            <p className="text-xs font-bold text-emerald-700 text-center">You have completed this topic.</p>
          ) : result ? (
            <div className="space-y-3">
              <div className={`rounded-2xl border p-4 text-center ${result.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className="text-2xl font-extrabold text-slate-900">{result.pct}%</p>
                <p className="text-xs text-slate-700">
                  {result.score} of {result.total} correct · best score {result.bestPct}%
                </p>
                <p className="text-xs font-bold mt-1 text-slate-800">
                  {result.passed ? 'You passed this topic.' : 'Not passed yet. Read the topic again and retry.'}
                </p>
              </div>
              {topic.quiz.map((q, qi) => {
                const r = result.results.find((x) => x.questionId === q.id);
                if (!r) return null;
                return (
                  <div key={q.id} className={`rounded-2xl border p-4 space-y-2 ${r.correct ? 'border-emerald-200 bg-white' : 'border-rose-200 bg-white'}`}>
                    <p className="text-xs font-bold text-slate-900 flex items-start gap-1.5">
                      {r.correct ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <span>
                        {qi + 1}. {q.question}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Your answer: <strong>{r.chosenIndex === null ? 'Not answered' : q.options[r.chosenIndex]}</strong>
                    </p>
                    {!r.correct && (
                      <p className="text-[11px] text-emerald-700">
                        Correct answer: <strong>{q.options[r.correctIndex]}</strong>
                      </p>
                    )}
                    {r.explanation && <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2.5 leading-relaxed">{r.explanation}</p>}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAnswers({});
                    setResult(null);
                    window.scrollTo({ top: 0 });
                  }}
                  className={`${btn} flex-1 bg-blue-600 text-white`}
                >
                  Try again
                </button>
                <button
                  onClick={() => {
                    setTopic(null);
                    setResult(null);
                    loadList();
                  }}
                  className={`${btn} flex-1 bg-slate-100 text-slate-700`}
                >
                  All topics
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-extrabold text-slate-900">Quiz: {topic.quiz.length} questions</p>
              {prog?.bestPct !== null && prog?.bestPct !== undefined && <p className="text-[11px] text-slate-500">Your best score so far: {prog.bestPct}%</p>}
              {topic.quiz.map((q, qi) => (
                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-900">
                    {qi + 1}. {q.question}
                  </p>
                  {q.options.map((o, oi) => (
                    <label key={oi} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${answers[q.id] === oi ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="mt-0.5 w-4 h-4 shrink-0" />
                      <span className="text-slate-800">
                        <strong>{String.fromCharCode(65 + oi)}.</strong> {o}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              <button onClick={submitQuiz} disabled={busy} className={`${btn} w-full bg-blue-600 text-white disabled:opacity-60`}>
                {busy ? 'Marking...' : 'Submit quiz'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
