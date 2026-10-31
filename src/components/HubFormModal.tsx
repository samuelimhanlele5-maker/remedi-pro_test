import React, { useState } from 'react';
import { api } from '../services/api.ts';
import { LearningHub } from '../types.ts';
import { X } from 'lucide-react';

interface HubFormModalProps {
  hub?: LearningHub; // when given, the form edits this hub
  onSaved: (hub: LearningHub) => void;
  onClose: () => void;
}

const inputCls =
  'w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600';
const labelCls = 'block text-[11px] font-bold text-slate-700 mb-1';

export const HubFormModal: React.FC<HubFormModalProps> = ({ hub, onSaved, onClose }) => {
  const [title, setTitle] = useState(hub?.title || '');
  const [description, setDescription] = useState(hub?.description || '');
  const [institution, setInstitution] = useState(hub?.institution || '');
  const [examBody, setExamBody] = useState(hub?.examBody || 'JAMB');
  const [subjectsText, setSubjectsText] = useState((hub?.subjects || []).join(', '));
  const [maxSubjects, setMaxSubjects] = useState<number | ''>(hub?.maxSubjects ?? 4);
  const [accessType, setAccessType] = useState<'free' | 'paid'>(hub?.accessType === 'paid' ? 'paid' : 'free');
  const [fee, setFee] = useState<number | ''>(hub?.membershipFee ?? '');
  const [paymentInstructions, setPaymentInstructions] = useState(hub?.paymentInstructions || '');
  const [joinMode, setJoinMode] = useState<'open' | 'approval'>(hub?.joinMode === 'approval' ? 'approval' : 'open');
  const [isPublic, setIsPublic] = useState(hub ? hub.isPublic !== false : true);
  const [objectives, setObjectives] = useState(hub?.objectives || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const subjects = subjectsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const data = {
      title,
      description,
      institution,
      examBody,
      subjects,
      maxSubjects: maxSubjects === '' ? 0 : maxSubjects,
      accessType,
      membershipFee: accessType === 'paid' ? (fee === '' ? 0 : fee) : undefined,
      paymentInstructions: accessType === 'paid' ? paymentInstructions : undefined,
      joinMode,
      isPublic,
      objectives,
    };
    setSaving(true);
    try {
      const res = hub ? await api.updateHub(hub.id, data) : await api.createHub(data);
      onSaved(res.hub);
    } catch (err: any) {
      setError(err.message || 'Could not save the hub.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center">
      <form
        onSubmit={submit}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-sm font-bold text-slate-900">{hub ? 'Edit Learning Hub' : 'Create Learning Hub'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

          <div>
            <label className={labelCls}>Hub name *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Institution or tutorial centre</label>
            <input className={inputCls} value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Examination body or purpose</label>
            <input
              className={inputCls}
              value={examBody}
              onChange={(e) => setExamBody(e.target.value)}
              placeholder="e.g. JAMB"
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Subjects offered * (separate with commas)</label>
            <textarea
              className={inputCls}
              rows={2}
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              placeholder="English, Biology, Chemistry, Physics"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold text-slate-700">Most subjects a student may choose:</label>
            <input
              type="number"
              min={0}
              value={maxSubjects}
              onChange={(e) => setMaxSubjects(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-16 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <span className="text-[11px] text-slate-500">0 = no limit</span>
          </div>
          <div>
            <label className={labelCls}>Learning objectives</label>
            <textarea className={inputCls} rows={2} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Access</label>
              <select className={inputCls} value={accessType} onChange={(e) => setAccessType(e.target.value as any)}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Joining</label>
              <select className={inputCls} value={joinMode} onChange={(e) => setJoinMode(e.target.value as any)}>
                <option value="open">Open: anyone can join</option>
                <option value="approval">I approve each student</option>
              </select>
            </div>
          </div>

          {accessType === 'paid' && (
            <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div>
                <label className={labelCls}>Fee</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={fee}
                  onChange={(e) => setFee(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div>
                <label className={labelCls}>How students pay you</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Payment is confirmed by you. A student stays pending until you approve them after you receive their
                payment. Remedi Pro does not collect this money.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4" />
            <span>Show this hub in search (off = only people with your link can find it)</span>
          </label>
        </div>

        <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl"
          >
            {saving ? 'Saving...' : hub ? 'Save changes' : 'Create hub'}
          </button>
        </div>
      </form>
    </div>
  );
};
