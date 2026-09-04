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
   <div className="min-h-screen bg-base flex items-center justify-center text-fg-3">
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
  <div className="min-h-screen bg-base font-display text-fg flex flex-col max-w-md mx-auto border-x border-line">
   {/* Header */}
   <div className="bg-base/90 backdrop-blur-md px-4 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-line">
    <button onClick={onBack} className="p-2 text-fg-2 hover:text-fg hover:bg-gray-800 ">
     <ArrowLeft size={20} />
    </button>
    <div>
     <h1 className="text-xl font-bold text-fg">Admin</h1>
     <p className="text-xs text-fg-3">Selects management</p>
    </div>
   </div>

   {/* Tabs */}
   <div className="px-4 pt-4 pb-0">
    <div className="flex bg-gray-900 p-1 gap-1">
     <TabBtn active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={14} />} label="Users" />
     <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')} icon={<Activity size={14} />} label="Activity" />
    </div>
   </div>

   <div className="flex-1 overflow-y-auto p-4">
    {loading ? (
     <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-fg-3 animate-spin" />
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
       <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Allowed users</p>
       <button
        onClick={() => setShowAdd((s) => !s)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 min-h-11 min-w-11"
            aria-label="Go back"
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
         className="flex-1 bg-black/40 border border-line px-3 py-2.5 text-fg text-sm outline-none focus:border-blue-500 placeholder-gray-600"
        />
        <button
         onClick={addUser}
         disabled={!newEmail.trim() || adding}
         className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-fg text-sm font-medium disabled:opacity-40 flex items-center gap-1"
        >
         {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
         Add
        </button>
       </div>
      )}

      {/* User list */}
      {whitelist.map((entry) => (
       <div key={entry.email} className="flex items-center gap-3 bg-gray-900/60 border border-line px-3 py-3">
        <div className={`w-2 h-2 shrink-0 ${entry.allowed ? 'bg-green-400' : 'bg-red-400'}`} />
        <p className="flex-1 text-sm text-fg truncate">{entry.email}</p>
        {entry.allowed && (
         <button
          onClick={() => removeUser(entry.email)}
          disabled={removing === entry.email}
          className="p-1.5 text-fg-3 hover:text-red-400 transition-colors disabled:opacity-40"
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
       <p className="text-sm text-fg-3 text-center py-8">No users yet.</p>
      )}
     </div>
    ) : (
     <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-fg-3 mb-3">Recent activity (last 50)</p>
      {activity.length === 0 && (
       <p className="text-sm text-fg-3 text-center py-8">No activity logged yet.</p>
      )}
      {activity.map((log) => (
       <div key={log.id} className="bg-gray-900/60 border border-line px-3 py-2.5 flex items-start gap-3">
        <div className="w-2 h-2 bg-blue-500 mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
         <p className="text-xs font-medium text-fg truncate">{log.event}</p>
         <p className="text-xs text-fg-3 truncate">{log.email || log.userId}</p>
        </div>
        <p className="text-[10px] text-fg-3 shrink-0 pt-0.5">{formatTime(log.timestamp)}</p>
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
  <div className="bg-gray-900/60 border border-line p-3 text-center">
   <p className="text-2xl font-bold text-fg">{value}</p>
   <p className="text-xs text-fg-3">{label}</p>
  </div>
 );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
 return (
  <button
   onClick={onClick}
   className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white text-black' : 'text-fg-2 hover:text-fg'}`}
  >
   {icon}{label}
  </button>
 );
}
