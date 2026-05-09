import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, Shield, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'unverified'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isVerified: !currentStatus
      });
      setUsers(users.map(u =>
        u.id === userId ? { ...u, isVerified: !currentStatus } : u
      ));
      toast.success(`Utilisateur ${!currentStatus ? 'vérifié' : 'non vérifié'}`);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleProStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isPro: !currentStatus
      });
      setUsers(users.map(u =>
        u.id === userId ? { ...u, isPro: !currentStatus } : u
      ));
      toast.success(`Statut Pro ${!currentStatus ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ?\n\nCette action est irréversible et supprimera :\n- Le compte utilisateur\n- Toutes ses données\n- Son historique de matchs\n\nATTENTION : Si cet utilisateur est inscrit à des tournois, cela peut causer des problèmes.`)) {
      return;
    }

    try {
      // Supprimer l'utilisateur de Firestore
      await deleteDoc(doc(db, 'users', userId));

      // Mettre à jour la liste locale
      setUsers(users.filter(u => u.id !== userId));
      toast.success('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.customUserId && user.customUserId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'verified' && user.isVerified) ||
      (filterStatus === 'unverified' && !user.isVerified);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-gray-500 mt-1">{users.length} utilisateurs au total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterStatus('verified')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'verified'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Vérifiés
            </button>
            <button
              onClick={() => setFilterStatus('unverified')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterStatus === 'unverified'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Non vérifiés
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jeu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="ml-4">
                         <div className="text-sm font-medium text-gray-900">{user.username}</div>
                         <div className="text-xs text-indigo-600 font-bold">{user.customUserId || 'ID standard'}</div>
                         <div className="text-xs text-gray-500">Niveau {user.level}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-500">{user.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.gameType || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{user.gameId || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.stats?.wins || 0}V / {user.stats?.matches || 0}M</div>
                    <div className="text-sm text-gray-500">{user.stats?.winRate || 0}% WR</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.isVerified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {user.isVerified ? 'Vérifié' : 'Non vérifié'}
                      </span>
                      {user.isPro && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Pro
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/users/${user.id}`)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleVerification(user.id, user.isVerified)}
                        className={`p-2 rounded-lg transition-colors ${user.isVerified
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                          }`}
                        title={user.isVerified ? 'Retirer vérification' : 'Vérifier'}
                      >
                        {user.isVerified ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => toggleProStatus(user.id, user.isPro)}
                        className={`p-2 rounded-lg transition-colors ${user.isPro
                          ? 'text-purple-600 hover:bg-purple-50'
                          : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        title={user.isPro ? 'Retirer Pro' : 'Promouvoir Pro'}
                      >
                        <Shield className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer l'utilisateur"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
