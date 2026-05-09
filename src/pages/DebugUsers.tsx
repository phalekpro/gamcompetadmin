import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, RefreshCw, Code, User as UserIcon } from 'lucide-react';

export default function DebugUsers() {
  const [fakeUsers, setFakeUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchFakeUsers();
  }, []);

  const fetchFakeUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('isDebug', '==', true));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setFakeUsers(usersData);
    } catch (error) {
      console.error('Error fetching fake users:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const generateFakeUser = async () => {
    setIsGenerating(true);
    try {
      const randomId = Math.random().toString(36).substring(2, 10);
      const debugCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits code
      
      const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
      const suffixes = ['Pro', 'Killer', 'Ghost', 'Shadow', 'Warrior', 'King', 'Viper', 'Nexus'];
      const username = `${names[Math.floor(Math.random() * names.length)]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}_${Math.floor(Math.random() * 100)}`;

      const fakeUser: Partial<User> = {
        username,
        email: `fake_${randomId}@gamecompet.test`,
        phone: '+33600000000',
        level: Math.floor(Math.random() * 20) + 1,
        isPro: Math.random() > 0.7,
        isVerified: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        role: 'user',
        stats: {
          tournaments: Math.floor(Math.random() * 10),
          matches: Math.floor(Math.random() * 50),
          wins: Math.floor(Math.random() * 25),
          winRate: 0,
          totalEarnings: Math.floor(Math.random() * 5000)
        },
        wallet: {
          balance: Math.floor(Math.random() * 10000),
          currency: 'FCFA'
        },
        createdAt: serverTimestamp(),
        isDebug: true,
        debugCode: debugCode
      };

      // Calculate winRate
      if (fakeUser.stats && fakeUser.stats.matches > 0) {
        fakeUser.stats.winRate = Math.round((fakeUser.stats.wins / fakeUser.stats.matches) * 100);
      }

      const userRef = doc(db, 'users', `fake_${randomId}`);
      await setDoc(userRef, fakeUser);
      
      await fetchFakeUsers();
      toast.success(`Joueur fake "${username}" généré avec le code: ${debugCode}`);
    } catch (error) {
      console.error('Error generating fake user:', error);
      toast.error('Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setFakeUsers(fakeUsers.filter(u => u.id !== userId));
      toast.success('Joueur supprimé');
    } catch (error) {
      toast.error('Erreur de suppression');
    }
  };

  const updateDebugCode = async (userId: string) => {
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      await updateDoc(doc(db, 'users', userId), {
        debugCode: newCode
      });
      setFakeUsers(fakeUsers.map(u => u.id === userId ? { ...u, debugCode: newCode } : u));
      toast.success('Code de connexion mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du code');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={generateFakeUser}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          Générer un Joueur Fake
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fakeUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-2xl bg-gray-100" />
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{user.username}</h3>
                    <p className="text-sm text-gray-500 truncate w-32">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase">FAKE</span>
                      {user.isPro && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-full uppercase">PRO</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Code Connexion</p>
                  <div className="flex items-center gap-2">
                    {user.debugCode ? (
                      <>
                        <Code className="w-4 h-4 text-indigo-600" />
                        <span className="font-mono font-bold text-lg text-indigo-600">{user.debugCode}</span>
                      </>
                    ) : (
                      <button
                        onClick={() => updateDebugCode(user.id)}
                        className="text-xs text-orange-600 font-bold hover:underline"
                      >
                        Générer un code
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Win Rate</p>
                  <div className="flex items-center gap-2 text-gray-900">
                    <span className="font-bold text-lg">{user.stats.winRate}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-500 border-t border-gray-50 pt-4">
                <div className="flex items-center gap-1">
                  <UserIcon className="w-4 h-4" />
                  <span>Level {user.level}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-900">{user.stats.wins}</span> Victoires
                </div>
              </div>
            </div>
          </div>
        ))}

        {fakeUsers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-bold">Aucun joueur fake</h3>
            <p className="text-gray-500 text-sm mt-1">Générez votre premier joueur de test pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}
