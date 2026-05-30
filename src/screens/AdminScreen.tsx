import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  limit,
} from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Trash2, Users, Activity, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

const ADMIN_EMAIL = 'shroomyai2000@gmail.com';

type WhitelistEntry = { email: string; allowed: boolean };
type ActivityLog = { id: string; userId: string; email: string; event: string; timestamp: any };

export default function AdminScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Guard: only admin can see this
  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-gray-500">
        Access denied.
      </div>
    );
  }

  return <AdminContent onBack={() => navigate('/app')} />;
}

function AdminContent({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'users' | 'activity'>('users');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadWhitelist = async () => {
    const snap = await getDocs(collection(db, 'whitelist'));
    setWhitelist(
      snap.docs.map((d) => ({ email: d.id, allowed: d.data().allowed ?? false }))
        .sort((a, b) => a.email.localeCompare(b.email))
    );
  };

  const loadActivity = async () => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    setActivity(
      snap.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId ?? '',
        email: d.data().email ?? d.data().userEmail ?? '',
        event: d.data().event ?? d.data().action ?? d.data().type ?? 'event',
        timestamp: d.data().timestamp,
      }))
    );
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadWhitelist(), loadActivity()]).finally(() => setLoading(false));
  }, []);

  const addUser = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    await setDoc(doc(db, 'whitelist', email), { allowed: true });
    await loadWhitelist();
    setNewEmail('');
    setShowAdd(false);
    setAdding(false);
  };

  const removeUser = async (email: string) => {
    if (!confirm(`Remove ${email} from the whitelist? They'll lose access immediately.`)) return;
    setRemoving(email);
    await deleteDoc(doc(db, 'whitelist', email));
    setWhitelist((w) => w.filter((e) => e.email !== email));
    setRemoving(null);
  };

  const formatTime = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-gray-100 flex flex-col max-w-md mx-auto border-x border-gray-800">
      {/* Header */}
      <div className="bg-[#09090b]/90 backdrop-blur-md px-4 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-800">
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Admin</h1>
          <p className="text-xs text-gray-500">Selects management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={14} />} label="Users" />
          <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')} icon={<Activity size={14} />} label="Activity" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : tab === 'users' ? (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Whitelisted" value={whitelist.filter(e => e.allowed).length} />
              <StatCard label="Blocked" value={whitelist.filter(e => !e.allowed).length} />
            </div>

            {/* Add user */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Allowed users</p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                {showAdd ? <X size={14} /> : <Plus size={14} />}
                {showAdd ? 'Cancel' : 'Add'}
              </button>
            </div>

            {showAdd && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUser()}
                  placeholder="email@example.com"
                  className="flex-1 bg-black/40 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500 placeholder-gray-600"
                />
                <button
                  onClick={addUser}
                  disabled={!newEmail.trim() || adding}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center gap-1"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
            )}

            {/* User list */}
            {whitelist.map((entry) => (
              <div key={entry.email} className="flex items-center gap-3 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${entry.allowed ? 'bg-green-400' : 'bg-red-400'}`} />
                <p className="flex-1 text-sm text-white truncate">{entry.email}</p>
                {entry.allowed && (
                  <button
                    onClick={() => removeUser(entry.email)}
                    disabled={removing === entry.email}
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Remove access"
                  >
                    {removing === entry.email
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            ))}

            {whitelist.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-8">No users yet.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Recent activity (last 50)</p>
            {activity.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-8">No activity logged yet.</p>
            )}
            {activity.map((log) => (
              <div key={log.id} className="bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{log.event}</p>
                  <p className="text-xs text-gray-500 truncate">{log.email || log.userId}</p>
                </div>
                <p className="text-[10px] text-gray-600 shrink-0 pt-0.5">{formatTime(log.timestamp)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
    >
      {icon}{label}
    </button>
  );
}
