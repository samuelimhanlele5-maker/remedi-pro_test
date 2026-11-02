import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { LearningHub, HubMaterial, HubMember, Quiz } from '../types.ts';
import { HubFormModal } from '../components/HubFormModal.tsx';
import { TopicBuilder } from '../components/TopicBuilder.tsx';
import { TopicReader } from '../components/TopicReader.tsx';
import { BookOpen, Users, FileText, GraduationCap, Search, Copy, Check, X, Plus, Clock } from 'lucide-react';

interface LearningHubViewProps {
  onNavigate: (tab: string, meta?: any) => void;
  onTakeQuiz: (quizId: string) => void;
  focusHub?: string; // hub id or code to open (from a shared link or the Profile page)
  onFocusHandled?: () => void;
}

type HubDetail = LearningHub & { members: HubMember[]; materials: HubMaterial[]; quizzes: Quiz[] };

export const LearningHubView: React.FC<LearningHubViewProps> = ({ focusHub, onFocusHandled }) => {
  const { user } = useAuth();
  const [hubs, setHubs] = useState<LearningHub[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<HubDetail | null>(null);
  const [performance, setPerformance] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [matOpen, setMatOpen] = useState(false);
  const [matTitle, setMatTitle] = useState('');
  const [matType, setMatType] = useState<'note' | 'tutorial' | 'guide'>('note');
  const [matContent, setMatContent] = useState('');
  const [mode, setMode] = useState<'none' | 'builder' | 'reader'>('none');

  const say = (text: string, bad = false) => {
    setMessage({ text, bad });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadList = async (q?: string) => {
    try {
      setLoading(true);
      const res = await api.getHubs(q);
      setHubs(res.hubs || []);
    } catch {
      say('Could not load hubs.', true);
    } finally {
      setLoading(false);
    }
  };

  const openHub = async (idOrCode: string) => {
    try {
      const res = await api.getHub(idOrCode);
      setHub(res.hub);
      setPicked(res.hub.myMembership?.selectedSubjects || []);
      setEditingSubjects(false);
      setPerformance([]);
      const manage = res.hub.myStatus === 'owner' || user?.role === 'admin';
      if (manage) {
        try {
          const perf = await api.getHubPerformance(res.hub.id);
          setPerformance(perf.performance || []);
        } catch {}
      }
    } catch (e: any) {
      say(e.message || 'Hub not found.', true);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (focusHub) {
      openHub(focusHub);
      onFocusHandled?.();
    }
  }, [focusHub]);

  const refresh = async () => {
    if (hub) await openHub(hub.id);
    loadList(search || undefined);
  };

  const manage = !!hub && (hub.myStatus === 'owner' || user?.role === 'admin');
  const max = hub?.maxSubjects ?? 0;
  const needsApproval = !!hub && ((hub.joinMode ?? 'open') === 'approval' || hub.accessType === 'paid');

  const toggleSubject = (s: string) => {
    setPicked((cur) => {
      if (cur.includes(s)) return cur.filter((x) => x !== s);
      if (max > 0 && cur.length >= max) {
        say(`You can choose at most ${max} subject${max === 1 ? '' : 's'}.`, true);
        return cur;
      }
      return [...cur, s];
    });
  };

  const join = async () => {
    if (!hub) return;
    try {
      const res = await api.joinHub(hub.id, picked);
      say(res.message || 'Done.');
      await refresh();
    } catch (e: any) {
      say(e.message || 'Could not join.', true);
    }
  };

  const saveSubjects = async () => {
    if (!hub) return;
    try {
      await api.setMySubjects(hub.id, picked);
      say('Subjects saved.');
      setEditingSubjects(false);
      await refresh();
    } catch (e: any) {
      say(e.message || 'Could not save.', true);
    }
  };

  const leave = async () => {
    if (!hub?.myMembership) return;
    if (!window.confirm('Leave this hub?')) return;
    try {
      await api.removeHubMember(hub.id, hub.myMembership.id);
      say('You left the hub.');
      await refresh();
    } catch (e: any) {
      say(e.message || 'Could not leave.', true);
    }
  };

  const decide = async (m: HubMember, status: 'active' | 'rejected') => {
    if (!hub) return;
    try {
      await api.setHubMemberStatus(hub.id, m.id, status);
      say(status === 'active' ? `${m.userName} approved.` : `${m.userName} declined.`);
      await refresh();
    } catch (e: any) {
      say(e.message || 'Could not update.', true);
    }
  };

  const remove = async (m: HubMember) => {
    if (!hub || !window.confirm(`Remove ${m.userName} from this hub?`)) return;
    try {
      await api.removeHubMember(hub.id, m.id);
      say('Member removed.');
      await refresh();
    } catch (e: any) {
      say(e.message || 'Could not remove.', true);
    }
  };

  const deleteHub = async () => {
    if (!hub) return;
    if (!window.confirm(`Delete "${hub.title}"? Its members and materials will be removed. This cannot be undone.`)) return;
    try {
      await api.deleteHub(hub.id);
      setHub(null);
      say('Hub deleted.');
      loadList(search || undefined);
    } catch (e: any) {
      say(e.message || 'Could not delete.', true);
    }
  };

  const link = hub ? `${window.location.origin}/?hub=${hub.hubCode || hub.id}` : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const addMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hub || !matTitle.trim() || !matContent.trim()) return;
    try {
      await api.addMaterial(hub.id, { creatorId: user?.id || '', title: matTitle.trim(), description: '', type: matType, content: matContent.trim() });
      setMatOpen(false);
      setMatTitle('');
      setMatContent('');
      say('Material added.');
      await refresh();
    } catch (err: any) {
      say(err.message || 'Could not add material.', true);
    }
  };

  const btn = 'px-3 py-2 text-xs font-bold rounded-xl';
  const status = hub?.myStatus;

  // Topics: the creator's builder and the student's reader take over the page
  if (hub && mode === 'builder') {
    return <TopicBuilder hub={hub} onClose={() => setMode('none')} />;
  }
  if (hub && mode === 'reader') {
    return <TopicReader hub={hub} onBack={() => setMode('none')} />;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {message && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg ${
            message.bad ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      {!hub ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h1 className="text-base font-extrabold text-slate-900">Learning Hubs</h1>
            <p className="text-xs text-slate-500 mt-1">Find a tutorial hub and join it. Hubs are created from your Profile.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                loadList(search || undefined);
              }}
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, subject, JAMB..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button type="submit" className={`${btn} bg-blue-600 text-white`}>
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 text-center py-8">Loading hubs...</p>
          ) : hubs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              {search ? 'No hubs match your search.' : 'No hubs yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {hubs.map((h) => (
                <button
                  key={h.id}
                  onClick={() => openHub(h.id)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-4 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{h.title}</h3>
                    {h.myStatus && (
                      <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {h.myStatus === 'owner' ? 'Yours' : h.myStatus === 'active' ? 'Joined' : h.myStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {[h.institution, h.examBody].filter(Boolean).join(' · ') || 'Learning hub'} · by {h.creatorName}
                  </p>
                  {h.subjects && h.subjects.length > 0 && (
                    <p className="text-[11px] text-slate-600">{h.subjects.join(', ')}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {h.memberCount ?? 0} members · {h.accessType === 'paid' ? 'Paid' : 'Free'} ·{' '}
                    {(h.joinMode ?? 'open') === 'approval' ? 'Approval needed' : 'Open'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setHub(null)} className="text-xs font-semibold text-blue-600 hover:underline">
            ← All hubs
          </button>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{hub.title}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {[hub.institution, hub.examBody].filter(Boolean).join(' · ')}
                {(hub.institution || hub.examBody) && ' · '}by {hub.creatorName}
              </p>
            </div>
            {hub.description && <p className="text-xs text-slate-700 leading-relaxed">{hub.description}</p>}
            {hub.objectives && (
              <div>
                <p className="text-[11px] font-bold text-slate-700">Objectives</p>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{hub.objectives}</p>
              </div>
            )}
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <p>
                <strong className="text-slate-700">Subjects:</strong> {(hub.subjects || []).join(', ') || 'Not listed'}
                {max > 0 && ` (choose up to ${max})`}
              </p>
              <p>
                <strong className="text-slate-700">Access:</strong>{' '}
                {hub.accessType === 'paid'
                  ? `Paid${hub.membershipFee ? `, ${hub.membershipFee}` : ''}. The creator confirms your payment.`
                  : 'Free'}
                {' · '}
                {(hub.joinMode ?? 'open') === 'approval' ? 'The creator approves each student' : 'Open joining'}
              </p>
              {hub.accessType === 'paid' && hub.paymentInstructions && (
                <p>
                  <strong className="text-slate-700">How to pay:</strong> {hub.paymentInstructions}
                </p>
              )}
              <p>{hub.memberCount ?? 0} members</p>
            </div>
          </div>

          {/* Student: join / status */}
          {!manage && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              {!user ? (
                <p className="text-xs text-slate-600">Log in to join this hub.</p>
              ) : status === 'active' && !editingSubjects ? (
                <>
                  <p className="text-xs font-bold text-emerald-700">You are a member of this hub.</p>
                  <p className="text-xs text-slate-600">
                    <strong>Your subjects:</strong> {(hub.myMembership?.selectedSubjects || []).join(', ') || 'None chosen'}
                  </p>
                  <button onClick={() => setMode('reader')} className={`${btn} w-full bg-emerald-600 text-white`}>
                    Study topics
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingSubjects(true)} className={`${btn} bg-slate-100 text-slate-700`}>
                      Change subjects
                    </button>
                    <button onClick={leave} className={`${btn} bg-slate-100 text-rose-600`}>
                      Leave hub
                    </button>
                  </div>
                </>
              ) : status === 'pending' ? (
                <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {hub.accessType === 'paid'
                    ? 'Waiting for the creator to confirm your payment.'
                    : 'Your request is waiting for the hub creator.'}
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-800">
                    {status === 'rejected' ? 'Your last request was declined. You can ask again.' : 'Choose your subjects'}
                  </p>
                  <div className="space-y-1.5">
                    {(hub.subjects || []).map((s) => (
                      <label key={s} className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="checkbox" checked={picked.includes(s)} onChange={() => toggleSubject(s)} className="w-4 h-4" />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                  {max > 0 && (
                    <p className="text-[11px] text-slate-500">
                      {picked.length} of {max} chosen
                    </p>
                  )}
                  {status === 'active' && editingSubjects ? (
                    <div className="flex gap-2">
                      <button onClick={saveSubjects} className={`${btn} bg-blue-600 text-white`}>
                        Save subjects
                      </button>
                      <button onClick={() => setEditingSubjects(false)} className={`${btn} bg-slate-100 text-slate-700`}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={join} disabled={(hub.subjects || []).length > 0 && picked.length === 0} className={`${btn} bg-blue-600 text-white disabled:opacity-50`}>
                      {needsApproval ? 'Request to join' : 'Join hub'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Creator tools */}
          {manage && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={copyLink} className={`${btn} bg-blue-50 text-blue-700 flex items-center gap-1.5`}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Link copied' : 'Copy hub link'}
                </button>
                <button onClick={() => setMode('builder')} className={`${btn} bg-emerald-600 text-white`}>
                  Manage topics
                </button>
                <button onClick={() => setFormOpen(true)} className={`${btn} bg-slate-100 text-slate-700`}>
                  Edit hub
                </button>
                <button onClick={() => setMatOpen(true)} className={`${btn} bg-slate-100 text-slate-700 flex items-center gap-1`}>
                  <Plus className="w-4 h-4" /> Add material
                </button>
                <button onClick={deleteHub} className={`${btn} bg-slate-100 text-rose-600`}>
                  Delete hub
                </button>
              </div>
              <p className="text-[11px] text-slate-500 break-all">{link}</p>

              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" /> Requests waiting ({hub.members.filter((m) => m.status === 'pending').length})
                </p>
                <div className="mt-2 space-y-2">
                  {hub.members.filter((m) => m.status === 'pending').length === 0 && (
                    <p className="text-[11px] text-slate-500">No requests waiting.</p>
                  )}
                  {hub.members
                    .filter((m) => m.status === 'pending')
                    .map((m) => (
                      <div key={m.id} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <p className="font-bold text-slate-900">{m.userName}</p>
                        <p className="text-slate-500">{m.userEmail}</p>
                        <p className="text-slate-600">{(m.selectedSubjects || []).join(', ')}</p>
                        {hub.accessType === 'paid' && (
                          <p className="text-[11px] text-amber-700">Approve only after you have received their payment.</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => decide(m, 'active')} className={`${btn} bg-emerald-600 text-white`}>
                            Approve
                          </button>
                          <button onClick={() => decide(m, 'rejected')} className={`${btn} bg-slate-100 text-rose-600`}>
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-600" /> Members ({hub.members.filter((m) => m.status !== 'pending' && m.status !== 'rejected').length})
                </p>
                <div className="mt-2 space-y-2">
                  {hub.members
                    .filter((m) => m.status !== 'pending' && m.status !== 'rejected')
                    .map((m) => {
                      const p = performance.find((x) => x.memberId === m.id);
                      return (
                        <div key={m.id} className="p-3 rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{m.userName}</p>
                            <p className="text-slate-500 truncate">{m.userEmail}</p>
                            <p className="text-slate-600">{(m.selectedSubjects || []).join(', ')}</p>
                            {p && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {p.quizzesTaken} quizzes · average {p.averageScore}
                              </p>
                            )}
                          </div>
                          <button onClick={() => remove(m)} className="shrink-0 p-1.5 text-slate-400 hover:text-rose-600" title="Remove">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Materials */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" /> Learning materials ({hub.materialCount ?? hub.materials.length})
            </p>
            {hub.materials.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {manage || status === 'active'
                  ? 'No materials posted yet.'
                  : 'Join this hub to read its materials.'}
              </p>
            ) : (
              hub.materials.map((mat) => (
                <div key={mat.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{mat.title}</span>
                    <span className="text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{mat.type}</span>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-line break-words">{mat.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {formOpen && hub && (
        <HubFormModal
          hub={hub}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            say('Hub updated.');
            refresh();
          }}
        />
      )}

      {matOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center">
          <form onSubmit={addMaterial} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Add learning material</h3>
            <input
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              placeholder="Title"
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <select value={matType} onChange={(e) => setMatType(e.target.value as any)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl">
              <option value="note">Note</option>
              <option value="tutorial">Tutorial</option>
              <option value="guide">Guide</option>
            </select>
            <textarea
              value={matContent}
              onChange={(e) => setMatContent(e.target.value)}
              placeholder="Text, or a link to a video or document"
              rows={4}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setMatOpen(false)} className={`${btn} flex-1 bg-slate-100 text-slate-700`}>
                Cancel
              </button>
              <button type="submit" className={`${btn} flex-1 bg-blue-600 text-white`}>
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
