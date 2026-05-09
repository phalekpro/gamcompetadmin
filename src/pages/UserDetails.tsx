import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Transaction, Match, Tournament } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, Save, X, User as UserIcon, Wallet, Trophy, Swords, Calendar } from 'lucide-react';

export default function UserDetails() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>(null);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch User
            const userRef = doc(db, 'users', userId!);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = { id: userSnap.id, ...userSnap.data() } as User;
                setUser(userData);
                setFormData(userData);
            } else {
                toast.error('Utilisateur non trouvé');
                navigate('/users');
                return;
            }

            // Fetch Transactions
            const transactionsQ = query(
                collection(db, 'transactions'),
                where('userId', '==', userId)
            );
            const transSnap = await getDocs(transactionsQ);
            const transData = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            // Sort in-memory to avoid composite index requirement
            transData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setTransactions(transData);

            // Fetch Matches
            const matchesQ = query(
                collection(db, 'matches'),
                where('player1Id', '==', userId)
            );
            const matchesSnap1 = await getDocs(matchesQ);

            const matchesQ2 = query(
                collection(db, 'matches'),
                where('player2Id', '==', userId)
            );
            const matchesSnap2 = await getDocs(matchesQ2);

            const allMatches = [
                ...matchesSnap1.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)),
                ...matchesSnap2.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match))
            ];

            // Filter unique matches
            const uniqueMatches = Array.from(new Map(allMatches.map(m => [m.id, m])).values());
            // Sort in-memory
            uniqueMatches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMatches(uniqueMatches);

            // Fetch Tournaments
            const tournamentsQ = query(collection(db, 'tournaments'));
            const tournamentsSnap = await getDocs(tournamentsQ);
            const allTournaments = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));

            // Filter and fetch detailed participant data
            const userTournamentsRaw = allTournaments.filter(t => t.participants?.includes(userId!));

            const userTournamentsWithData = await Promise.all(userTournamentsRaw.map(async (t) => {
                const partRef = doc(db, 'tournaments', t.id, 'participants', userId!);
                const partSnap = await getDoc(partRef);
                if (partSnap.exists()) {
                    return {
                        ...t,
                        participantsData: {
                            [userId!]: partSnap.data() as any
                        }
                    };
                }
                return t;
            }));

            setTournaments(userTournamentsWithData);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        try {
            const userRef = doc(db, 'users', userId!);
            const { id, ...updateData } = formData;
            await updateDoc(userRef, updateData);
            setUser(formData);
            setIsEditing(false);
            toast.success('Profil mis à jour');
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error('Erreur lors de la mise à jour');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/users')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Retour aux utilisateurs
                </button>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                                Annuler
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                                <Save className="w-5 h-5" />
                                Enregistrer
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                            <Edit2 className="w-5 h-5" />
                            Modifier le profil
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Profile */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
                        <img src={user.avatarUrl} alt={user.username} className="w-32 h-32 rounded-full mb-4 border-4 border-primary/10" />
                        <h2 className="text-2xl font-bold text-gray-900">{user.username}</h2>
                        <p className="text-gray-500 text-xs">ID: {user.id}</p>
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {user.isVerified ? 'Vérifié' : 'Non vérifié'}
                            </span>
                            {user.isPro && <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Pro</span>}
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Niveau {user.level}</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-primary" />
                            Informations Joueur & Vérification
                        </h3>
                        <div className="space-y-4">
                            {['username', 'email', 'phone', 'gameId', 'gameType', 'verificationStatus'].map((field) => (
                                <div key={field}>
                                    <label className="block text-sm font-medium text-gray-500 capitalize">
                                        {field === 'gameId' ? 'ID en jeu' : field === 'gameType' ? 'Jeu' : field === 'verificationStatus' ? 'Statut vérification' : field}
                                    </label>
                                    {isEditing ? (
                                        field === 'verificationStatus' ? (
                                            <select
                                                value={formData[field] || ''}
                                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            >
                                                <option value="pending">En attente</option>
                                                <option value="verified">Vérifié</option>
                                                <option value="rejected">Rejeté</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData[field] || ''}
                                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                        )
                                    ) : (
                                        <p className="text-gray-900 font-medium">
                                            {field === 'verificationStatus'
                                                ? (user.verificationStatus === 'verified' ? 'Vérifié ✅' : user.verificationStatus === 'rejected' ? 'Rejeté ❌' : 'En attente ⏳')
                                                : (user[field as keyof User] || 'N/A')}
                                        </p>
                                    )}
                                </div>
                            ))}

                            {user.supercellProofUrl && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-2">Preuve de profil (Supercell)</label>
                                    <a
                                        href={user.supercellProofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block relative group overflow-hidden rounded-lg border border-gray-100"
                                    >
                                        <img
                                            src={user.supercellProofUrl}
                                            alt="Preuve Supercell"
                                            className="w-full h-auto max-h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">Voir en grand</span>
                                        </div>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-primary" />
                            Portefeuille
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">Solde actuel</p>
                                <p className="text-2xl font-black text-gray-900">{user.wallet?.balance || 0} {user.wallet?.currency || 'FCFA'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: Activity */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Matches */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Swords className="w-5 h-5 text-primary" />
                                Derniers Matchs
                            </h3>
                            <span className="text-sm text-gray-500">{matches.length} matchs</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Résultat</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {matches.slice(0, 5).map((match) => (
                                        <tr key={match.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {match.player1Username} vs {match.player2Username}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={match.winnerId === userId ? 'text-green-600 font-bold' : match.winnerId ? 'text-red-600' : 'text-gray-500'}>
                                                    {match.winnerId === userId ? 'Victoire' : match.winnerId ? 'Défaite' : 'En attente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${match.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {match.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {matches.length === 0 && (
                                        <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Aucun match trouvé</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tournaments */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-primary" />
                                Tournois Rejoints & Données d'Inscription
                            </h3>
                            <span className="text-sm text-gray-500">{tournaments.length} tournois</span>
                        </div>
                        <div className="p-6 space-y-4">
                            {tournaments.map((t) => {
                                const participant = t.participantsData?.[userId!];
                                const regData = participant?.registrationData;
                                return (
                                    <div key={t.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                                <Trophy className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{t.name} <span className="text-xs font-normal text-gray-500 ml-2">#{participant?.transactionId || 'N/A'}</span></p>
                                                <p className="text-xs text-gray-500">{t.game} • {participant?.paymentMethod} • {participant?.paymentAmount} FCFA</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                                            {regData?.supercellId && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Supercell ID</p>
                                                    <p className="text-sm font-medium text-gray-900">{regData.supercellId}</p>
                                                </div>
                                            )}
                                            {participant?.paymentPhone && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Tél. Paiement</p>
                                                    <p className="text-sm font-medium text-gray-900">{participant.paymentPhone}</p>
                                                </div>
                                            )}
                                            {regData?.kingLevel && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Niveau</p>
                                                    <p className="text-sm font-medium text-gray-900">Niv. {regData.kingLevel}</p>
                                                </div>
                                            )}
                                            {regData?.arenaName && (
                                                <div>
                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Arène</p>
                                                    <p className="text-sm font-medium text-gray-900">{regData.arenaName}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {tournaments.length === 0 && (
                                <p className="text-center text-gray-500 py-4">Aucun tournoi rejoint</p>
                            )}
                        </div>
                    </div>

                    {/* Transactions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Historique des Paiements
                            </h3>
                            <span className="text-sm text-gray-500">{transactions.length} transactions</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {transactions.slice(0, 5).map((t) => (
                                        <tr key={t.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{t.type}</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.amount >= 0 ? '+' : ''}{t.amount} FCFA
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Aucune transaction trouvée</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
