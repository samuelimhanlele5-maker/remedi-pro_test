import React, { useEffect, useState } from 'react';
import { api, TopicBlock, TopicFull, TopicSummary } from '../services/api.ts';
import { ArrowUp, ArrowDown, Trash2, Plus, ChevronLeft } from 'lucide-react';

interface TopicBuilderProps {
  hub: { id: string; title: string; subjects?: string[] };
  onClose: () => void;
}

interface EditQuestion {
  id?: string;
  question: string;
  options: string[]; // always 4 boxes while editing
  correct: number | null;
  explanation: string;
}

const inputCls =
  'w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600';

export const TopicBuilder: React.FC<TopicBuilderProps> = ({ hub, onClose }) => {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [open, setOpen] = useState<TopicFull | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<TopicBlock[]>([]);
  const [quiz, setQuiz] = useState<EditQuestion[]>([]);
  const [newSubject, setNewSubject] = useState(hub.subjects?.[0] || '');
  const [newTitle, setNewTitle] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const say = (text: string, bad = false) => {
    setMsg({ text, bad });
    setTimeout(() => setMsg(null), 4500);
  };

  const loadTopics = async () => {
    try {
      const res = await api.getTopics(hub.id);
      setTopics(res.topics || []);
    } catch (e: any) {
      say(e.message || 'Could not load topics.', true);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const openTopic = async (id: string) => {
    try {
      const res = await api.getTopic(hub.id, id);
      const t = res.topic;
      setOpen(t);
      setTitle(t.title);
      setBlocks(t.blocks || []);
      setQuiz(
        (t.quiz || []).map((q) => {
          const opts = [...q.options];
          while (opts.length < 4) opts.push('');
          return { id: q.id, question: q.question, options: opts, correct: q.answerIndex ?? null, explanation: q.explanation || '' };
        })
      );
    } catch (e: any) {
      say(e.message || 'Could not open topic.', true);
    }
  };

  const createTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await api.createTopic(hub.id, newSubject, newTitle.trim());
      setNewTitle('');
      await loadTopics();
      await openTopic(res.topic.id);
    } catch (err: any) {
      say(err.message || 'Could not create the topic.', true);
    }
  };

  // ---- blocks ----
  const addBlock = (type: TopicBlock['type']) => setBlocks((b) => [...b, type === 'text' ? { type, text: '' } : { type, url: '', caption: '' }]);
  const updateBlock = (i: number, patch: Partial<TopicBlock>) => setBlocks((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const removeBlock = (i: number) => setBlocks((b) => b.filter((_, k) => k !== i));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const c = [...b];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  // ---- quiz ----
  const addQuestion = () => setQuiz((q) => [...q, { question: '', options: ['', '', '', ''], correct: null, explanation: '' }]);
  const updateQ = (i: number, patch: Partial<EditQuestion>) => setQuiz((q) => q.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const updateOpt = (qi: number, oi: number, v: string) =>
    setQuiz((q) => q.map((x, k) => (k === qi ? { ...x, options: x.options.map((o, j) => (j === oi ? v : o)) } : x)));
  const removeQ = (i: number) => setQuiz((q) => q.filter((_, k) => k !== i));

  const save = async (): Promise<boolean> => {
    if (!open) return false;
    // drop empty blocks; turn the quiz boxes into the shape the server wants
    const cleanBlocks = blocks.filter((b) => (b.type === 'text' ? (b.text || '').trim() : (b.url || '').trim()));
    const cleanQuiz = [];
    for (let i = 0; i < quiz.length; i++) {
      const q = quiz[i];
      if (!q.question.trim() && q.options.every((o) => !o.trim())) continue; // untouched empty question
      if (q.correct === null || !q.options[q.correct]?.trim()) {
        say(`Question ${i + 1}: choose the correct answer, and fill that option in.`, true);
        return false;
      }
      const kept: string[] = [];
      let newCorrect = 0;
      q.options.forEach((o, j) => {
        if (o.trim()) {
          if (j === q.correct) newCorrect = kept.length;
          kept.push(o.trim());
        }
      });
      cleanQuiz.push({ id: q.id, question: q.question.trim(), options: kept, answerIndex: newCorrect, explanation: q.explanation.trim() });
    }
    setBusy(true);
    try {
      const res = await api.updateTopic(hub.id, open.id, { title, blocks: cleanBlocks, quiz: cleanQuiz });
      setOpen(res.topic);
      setBlocks(res.topic.blocks);
      say('Saved.');
      loadTopics();
      return true;
    } catch (e: any) {
      say(e.message || 'Could not save.', true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async () => {
    if (!open) return;
    const publishing = open.status !== 'published';
    if (!(await save())) return;
    try {
      await api.publishTopic(hub.id, open.id, publishing);
      say(publishing ? 'Published. Students can open it now.' : 'Unpublished. Students no longer see it.');
      const res = await api.getTopic(hub.id, open.id);
      setOpen(res.topic);
      loadTopics();
    } catch (e: any) {
      say(e.message || 'Could not change the status.', true);
    }
  };

  const remove = async () => {
    if (!open || !window.confirm(`Delete "${open.title}"? Students' progress on it is removed too.`)) return;
    try {
      await api.deleteTopic(hub.id, open.id);
      setOpen(null);
      say('Topic deleted.');
      loadTopics();
    } catch (e: any) {
      say(e.message || 'Could not delete.', true);
    }
  };

  const btn = 'px-3 py-2 text-xs font-bold rounded-xl';
  const subjects = hub.subjects || [];

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {msg && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg ${
            msg.bad ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {msg.text}
        </div>
      )}

      <button onClick={open ? () => { setOpen(null); loadTopics(); } : onClose} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ChevronLeft className="w-4 h-4" /> {open ? 'All topics' : hub.title}
      </button>

      {!open ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">Topics</h2>
            <form onSubmit={createTopic} className="space-y-2">
              <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className={inputCls}>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New topic title, e.g. Cell Structure" className={inputCls} />
              <button type="submit" className={`${btn} bg-blue-600 text-white flex items-center gap-1`}>
                <Plus className="w-4 h-4" /> Add topic
              </button>
            </form>
          </div>

          {subjects.map((s) => {
            const list = topics.filter((t) => t.subject.toLowerCase() === s.toLowerCase());
            return (
              <div key={s} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-extrabold text-slate-900">{s}</p>
                {list.length === 0 && <p className="text-[11px] text-slate-500">No topics yet.</p>}
                {list.map((t) => (
                  <button key={t.id} onClick={() => openTopic(t.id)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900 truncate">{t.title}</span>
                      <span className="block text-[11px] text-slate-500">
                        {t.blockCount} blocks · {t.quizCount} quiz questions
                      </span>
                    </span>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-500">{open.subject}</p>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${open.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {open.status}
              </span>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} font-bold`} />
          </div>

          {/* Content blocks, in the order students see them */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-extrabold text-slate-900">Content, in order</p>
            {blocks.length === 0 && <p className="text-[11px] text-slate-500">Add a write-up, picture or voice note below.</p>}
            {blocks.map((b, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-blue-700">
                    {b.type === 'text' ? 'Write-up' : b.type === 'image' ? 'Picture' : b.type === 'audio' ? 'Voice note' : 'Video link'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => moveBlock(i, -1)} className="p-1.5 text-slate-500 hover:text-blue-600" title="Move up">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveBlock(i, 1)} className="p-1.5 text-slate-500 hover:text-blue-600" title="Move down">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeBlock(i)} className="p-1.5 text-slate-500 hover:text-rose-600" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {b.type === 'text' ? (
                  <textarea value={b.text || ''} onChange={(e) => updateBlock(i, { text: e.target.value })} rows={5} placeholder="Write the explanation here" className={inputCls} />
                ) : (
                  <>
                    <input value={b.url || ''} onChange={(e) => updateBlock(i, { url: e.target.value })} placeholder="Paste the link (starts with https://)" className={inputCls} />
                    <input value={b.caption || ''} onChange={(e) => updateBlock(i, { caption: e.target.value })} placeholder="Caption (optional)" className={inputCls} />
                    {b.type === 'image' && b.url && /^https?:\/\//.test(b.url) && <img src={b.url} alt="" className="max-h-48 rounded-lg" />}
                    {b.type === 'audio' && b.url && /^https?:\/\//.test(b.url) && <audio controls preload="none" src={b.url} className="w-full" />}
                  </>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addBlock('text')} className={`${btn} bg-slate-100 text-slate-700`}>+ Write-up</button>
              <button onClick={() => addBlock('image')} className={`${btn} bg-slate-100 text-slate-700`}>+ Picture</button>
              <button onClick={() => addBlock('audio')} className={`${btn} bg-slate-100 text-slate-700`}>+ Voice note</button>
              <button onClick={() => addBlock('video')} className={`${btn} bg-slate-100 text-slate-700`}>+ Video link</button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pictures and voice notes are added by link for now. Uploading from your phone comes in the next update.
            </p>
          </div>

          {/* Quiz at the end of the topic */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-extrabold text-slate-900">Quiz at the end of this topic</p>
            {quiz.length === 0 && <p className="text-[11px] text-slate-500">No quiz yet. Students can finish the topic without one.</p>}
            {quiz.map((q, qi) => (
              <div key={qi} className="p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-blue-700">Question {qi + 1}</span>
                  <button onClick={() => removeQ(qi)} className="p-1.5 text-slate-500 hover:text-rose-600" title="Remove question">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea value={q.question} onChange={(e) => updateQ(qi, { question: e.target.value })} rows={2} placeholder="Question" className={inputCls} />
                {q.options.map((o, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => updateQ(qi, { correct: oi })} className="w-4 h-4 shrink-0" />
                    <input value={o} onChange={(e) => updateOpt(qi, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className={inputCls} />
                  </label>
                ))}
                <p className="text-[11px] text-slate-500">Tap the circle beside the correct answer.</p>
                <textarea value={q.explanation} onChange={(e) => updateQ(qi, { explanation: e.target.value })} rows={2} placeholder="Explanation shown to the student after the quiz" className={inputCls} />
              </div>
            ))}
            <button onClick={addQuestion} className={`${btn} bg-slate-100 text-slate-700`}>+ Add question</button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 text-white disabled:opacity-60`}>
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button onClick={togglePublish} disabled={busy} className={`${btn} ${open.status === 'published' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-600 text-white'} disabled:opacity-60`}>
              {open.status === 'published' ? 'Unpublish' : 'Save and publish'}
            </button>
            <button onClick={remove} className={`${btn} bg-slate-100 text-rose-600`}>Delete topic</button>
          </div>
        </div>
      )}
    </div>
  );
};
