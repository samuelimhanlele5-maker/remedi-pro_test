import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { LearningHub } from '../types.ts';
import {
  Compass,
  Search,
  BookOpen,
  Users,
  FileText,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

interface BrowseHubViewProps {
  onNavigate: (tab: string, meta?: any) => void;
}

export const BrowseHubView: React.FC<BrowseHubViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [hubs, setHubs] = useState<LearningHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [joinedHubIds, setJoinedHubIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      const res = await api.getHubs();
      setHubs(res.hubs || []);
    } catch (e) {
      console.error('Error fetching hubs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubs();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Joining now needs a subject choice, so it happens on the hub page
  const handleJoin = (hub: LearningHub) => {
    if (!user) {
      alert('Please sign in to join learning hubs.');
      return;
    }
    onNavigate('learning-hub', { hubId: hub.id });
  };

  const filtered = hubs.filter((h) => {
    const term = search.toLowerCase();
    return (
      h.title.toLowerCase().includes(term) ||
      h.subject.toLowerCase().includes(term) ||
      h.description.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
            Community Repositories
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Browse Learning Hubs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Discover peer learning communities, question banks, and syllabus guides authored by educators
          </p>
        </div>

        <button
          onClick={() => onNavigate('learning-hub')}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          My Enrolled Hubs
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by subject or hub focus (e.g. Life Sciences, Chemistry)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          Loading learning hubs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Learning Hubs Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try modifying your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((hub) => {
            const hasJoined = joinedHubIds.includes(hub.id);

            return (
              <div
                key={hub.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-100">
                      {hub.subject}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      by {hub.creatorName}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{hub.title}</h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                    {hub.description || 'Specialized learning hub containing study notes and CBT exam prep.'}
                  </p>

                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{hub.memberCount || 0} Members</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{hub.materialCount || 0} Guides</span>
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onNavigate('learning-hub')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open Hub →
                  </button>

                  <button
                    onClick={() => handleJoin(hub)}
                    disabled={hasJoined}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      hasJoined
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                    }`}
                  >
                    {hasJoined ? 'Enrolled ✓' : 'Join Community'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
