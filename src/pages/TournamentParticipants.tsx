
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayRemove, deleteDoc, serverTimestamp, limit, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, User } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, User as UserIcon, Trophy, Search, Download, Trash2, UserPlus, Plus, X } from 'lucide-react';
import { setDoc, arrayUnion, increment } from 'firebase/firestore';

interface Participant {
    id: string;
    username: string;
    customUserId?: string;
    avatarUrl: string;
    email?: string;
    phone?: string;
    registrationData?: {
        supercellId?: string;
        kingLevel?: number;
        arenaName?: string;
        [key: string]: any;
    };
    paymentStatus?: string;
    paymentAmount?: number;
    paymentPhone?: string;
    transactionId?: string;
    status: 'confirmed' | 'pending';
}

export default function TournamentParticipants() {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showUserSelector, setShowUserSelector] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [isAddingUser, setIsAddingUser] = useState(false);

    useEffect(() => {
        if (tournamentId) {
            fetchData();
        }
    }, [tournamentId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const tournamentRef = doc(db, 'tournaments', tournamentId!);
            const tournamentSnap = await getDoc(tournamentRef);

            if (!tournamentSnap.exists()) {
                toast.error('Tournoi non trouvé');
                navigate('/tournaments');
                return;
            }

            const tournamentData = { id: tournamentSnap.id, ...tournamentSnap.data() } as Tournament;
            setTournament(tournamentData);

            let participantsList: Participant[] = [];

            const participantIds = tournamentData.participants || [];
            const pDataMap = tournamentData.participantsData || {};
            
            // 1. D'abord, prendre tous ceux qui sont dans participantsData
            const fromDataMap: Participant[] = Object.values(pDataMap).map((p: any) => ({
                id: p.userId,
                username: p.username,
                customUserId: p.customUserId,
                debugCode: p.debugCode,
                avatarUrl: p.avatarUrl,
                registrationData: p.registrationData,
                paymentStatus: p.paymentStatus,
                paymentAmount: p.paymentAmount,
                paymentPhone: p.paymentPhone,
                transactionId: p.transactionId,
                status: 'confirmed'
            }));

            // 2. Identifier les IDs dans 'participants' qui ne sont pas dans 'participantsData'
            const missingIds = participantIds.filter(id => !pDataMap[id]);

            if (missingIds.length > 0) {
                // split into chunks of 10 for 'in' query
                const chunks = [];
                for (let i = 0; i < missingIds.length; i += 10) {
                    chunks.push(missingIds.slice(i, i + 10));
                }

                const fetchedParticipants: Participant[] = [];
                for (const chunk of chunks) {
                    const q = query(collection(db, 'users'), where('__name__', 'in', chunk)); // __name__ corresponds to document ID
                    const snapshot = await getDocs(q);
                    const users = snapshot.docs.map(d => {
                        const u = d.data();
                        return {
                            id: d.id,
                            username: u.username || 'Utilisateur inconnu',
                            avatarUrl: u.avatarUrl || '',
                            email: u.email || '',
                            phone: u.phone || '',
                            registrationData: {},
                            status: 'confirmed'
                        } as Participant;
                    });
                    fetchedParticipants.push(...users);
                }
                participantsList = [...fromDataMap, ...fetchedParticipants];
            } else {
                participantsList = fromDataMap;
            }

            // Filtrer pour ne garder que ceux qui sont dans le tableau participants (au cas où participantsData en contient en trop)
            participantsList = participantsList.filter(p => participantIds.includes(p.id));

            setParticipants(participantsList);
        } catch (error) {
            console.error('Error fetching participants:', error);
            toast.error('Erreur lors du chargement des participants');
        } finally {
            setLoading(false);
        }
    };

    const filteredParticipants = participants.filter(p =>
        p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.registrationData?.supercellId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportToCSV = () => {
        const headers = ['ID', 'Pseudo', 'Email', 'Téléphone', 'Jeu', 'Supercell ID', 'Niveau Roi', 'Arène', 'Statut Paiement', 'Montant', 'Transaction ID'];
        const rows = filteredParticipants.map(p => [
            p.id,
            p.username,
            p.email || 'N/A',
            p.phone || p.paymentPhone || 'N/A',
            tournament?.game,
            p.registrationData?.supercellId || 'N/A',
            p.registrationData?.kingLevel || 'N/A',
            p.registrationData?.arenaName || 'N/A',
            p.paymentStatus || 'N/A',
            p.paymentAmount || 'N/A',
            p.transactionId || 'N/A'
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `participants_${tournament?.name}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const deleteParticipant = async (participantId: string, participantName: string) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${participantName} de ce tournoi ?\n\nCette action est irréversible.`)) {
            return;
        }

        setDeletingId(participantId);
        try {
            const tournamentRef = doc(db, 'tournaments', tournamentId!);

            // 1. Retirer du tableau participants et supprimer du map participantsData
            await updateDoc(tournamentRef, {
                participants: arrayRemove(participantId),
                [`participantsData.${participantId}`]: deleteField()
            });

            // 2. Décrémenter currentParticipants
            await updateDoc(tournamentRef, {
                currentParticipants: increment(-1)
            });

            // 3. Supprimer de la sous-collection participants
            try {
                await deleteDoc(doc(db, 'tournaments', tournamentId!, 'participants', participantId));
            } catch (error) {
                console.log('Sous-collection participant non trouvée, ignoré');
            }

            // 4. Mettre à jour l'état local
            setParticipants(prev => prev.filter(p => p.id !== participantId));
            
            toast.success(`${participantName} a été retiré du tournoi`);
        } catch (error) {
            console.error('Error deleting participant:', error);
            toast.error('Erreur lors de la suppression du participant');
        } finally {
            setDeletingId(null);
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            const q = query(collection(db, 'users'), limit(50));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            // Filter out already participating users
            const existingIds = participants.map(p => p.id);
            setAvailableUsers(users.filter(u => !existingIds.includes(u.id)));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const addParticipantToTournament = async (user: User) => {
        if (!tournamentId) return;
        setIsAddingUser(true);
        try {
            const tournamentRef = doc(db, 'tournaments', tournamentId);
            
            // Nouveau format participantsData
            const pData: any = {
                userId: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl || '',
                registeredAt: serverTimestamp(),
                paymentStatus: 'completed',
                paymentAmount: tournament?.entryFee || 0,
                registrationData: {
                    gameId: user.gameId || 'N/A',
                    supercellId: user.gameId || 'N/A',
                    kingLevel: 1,
                    arenaName: 'Arena 1'
                }
            };

            // Ajouter les champs optionnels seulement s'ils existent (éviter undefined)
            if (user.customUserId) pData.customUserId = user.customUserId;
            if ((user as any).debugCode) pData.debugCode = (user as any).debugCode;

            // Mise à jour atomique du document tournoi
            const updatePayload: any = {
                participants: arrayUnion(user.id),
                currentParticipants: increment(1),
                [`participantsData.${user.id}`]: pData
            };

            await updateDoc(tournamentRef, updatePayload);

            // Compatibilité avec l'ancienne sous-collection (optionnel)
            try {
                const participantRef = doc(db, 'tournaments', tournamentId, 'participants', user.id);
                await setDoc(participantRef, {
                    ...pData,
                    status: 'confirmed'
                });
            } catch (subErr) {
                console.warn('Erreur écriture sous-collection (non-bloquant):', subErr);
            }

            setParticipants(prev => [...prev, {
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl,
                email: user.email,
                phone: user.phone,
                registrationData: pData.registrationData,
                status: 'confirmed',
                paymentStatus: 'completed',
                paymentAmount: pData.paymentAmount
            }]);

            toast.success(`${user.username} ajouté au tournoi`);
            setShowUserSelector(false);
        } catch (error) {
            console.error('Error adding participant:', error);
            toast.error('Erreur lors de l\'ajout');
        } finally {
            setIsAddingUser(false);
        }
    };

    const generateCustomUserId = (username: string, index: number) => {
        const abbreviation = username.split('_')[1]?.substring(0, 2).toUpperCase() || 'XX';
        const sequence = String(index).padStart(3, '0');
        return `USER-${sequence}-${abbreviation}`;
    };

    const generateFakeParticipant = async () => {
        setIsAddingUser(true);
        try {
            const randomId = Math.random().toString(36).substring(2, 10);
            const names = ['Xano', 'Vortix', 'Nexus', 'Blade', 'Cipher', 'Storm', 'Raven', 'Saber', 'Nova', 'Echo'];
            const suffixes = ['Master', 'Gamer', 'Pro', 'God', 'Snip', 'YT', 'TV', 'OFF'];
            const nameIdx = Math.floor(Math.random() * names.length);
            const username = `Test_${names[nameIdx]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
            
            // Get index for custom ID (based on current total users or participants)
            const sequence = Math.floor(Math.random() * 900) + 100;
            const customUserId = generateCustomUserId(username, sequence);

            const newUser: Partial<User> = {
                username,
                customUserId,
                email: `test_${randomId}@gamecompet.test`,
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                level: 1,
                isPro: false,
                isVerified: true,
                stats: { tournaments: 1, matches: 0, wins: 0, winRate: 0, totalEarnings: 0 },
                wallet: { balance: 0, currency: 'FCFA' },
                createdAt: serverTimestamp(),
                isDebug: true,
                debugCode: String(Math.floor(1000 + Math.random() * 9000)) // Add a debug code for easy login
            };

            const uid = `fake_${randomId}`;
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, newUser);
            
            await addParticipantToTournament({ id: uid, ...newUser } as User);
        } catch (error) {
            console.error('Error generating fake:', error);
            toast.error('Erreur de génération');
        } finally {
            setIsAddingUser(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!tournament) return null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/tournaments')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Retour aux tournois
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setShowUserSelector(true);
                            fetchAvailableUsers();
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <UserPlus className="w-5 h-5" />
                        Ajouter un Joueur
                    </button>
                    <button
                        onClick={generateFakeParticipant}
                        disabled={isAddingUser}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                        Joueur Fictif
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <Download className="w-5 h-5" />
                        Exporter CSV
                    </button>
                </div>
            </div>

            {/* User Selector Modal */}
            {showUserSelector && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900">Ajouter un participant</h3>
                            <button onClick={() => setShowUserSelector(false)} className="p-1 hover:bg-gray-200 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Chercher par nom..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {availableUsers
                                    .filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                                    .map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => addParticipantToTournament(user)}
                                            disabled={isAddingUser}
                                            className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100"
                                        >
                                            <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                                            <div className="text-left flex-1">
                                                <div className="text-sm font-bold text-gray-900">{user.username}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                            <Plus className="w-4 h-4 text-indigo-600" />
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <Trophy className="w-8 h-8 text-primary" />
                            Participants: {tournament.name}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {participants.length} inscrits / {tournament.maxParticipants} places
                        </p>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Rechercher un joueur..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joueur</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Info Jeu</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredParticipants.map((participant) => (
                                <tr key={participant.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img className="h-10 w-10 rounded-full object-cover" src={participant.avatarUrl || 'https://via.placeholder.com/40'} alt="" />
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{participant.username}</div>
                                                <div className="text-xs text-indigo-600 font-bold">{participant.customUserId || 'ID standard'}</div>
                                                {(participant as any).debugCode && (
                                                  <div className="text-[10px] text-indigo-500 font-mono font-bold">Code: {(participant as any).debugCode}</div>
                                                )}
                                                <div className="text-[10px] text-gray-400">UID: {participant.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{participant.phone || participant.paymentPhone || 'N/A'}</div>
                                        <div className="text-xs text-gray-500">{participant.email || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {participant.registrationData ? (
                                            <div>
                                                <div className="text-sm text-gray-900 font-bold">{participant.registrationData.gameId || participant.registrationData.supercellId || 'N/A'}</div>
                                                <div className="text-xs text-gray-500">
                                                    {participant.registrationData.playerLevel || participant.registrationData.kingLevel ? `Lvl ${participant.registrationData.playerLevel || participant.registrationData.kingLevel}` : ''}
                                                    {participant.registrationData.mode ? ` • ${participant.registrationData.mode}` : ''}
                                                    {participant.registrationData.arenaName ? ` • ${participant.registrationData.arenaName}` : ''}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">Non renseigné</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {participant.paymentStatus ? (
                                            <div>
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${participant.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {participant.paymentStatus === 'completed' ? 'Payé' : participant.paymentStatus}
                                                </span>
                                                <div className="text-xs text-gray-500 mt-1">{participant.paymentAmount} FCFA</div>
                                                <div className="text-[10px] text-gray-400">Ref: {participant.transactionId}</div>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/users/${participant.id}`)}
                                                className="text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                                                title="Voir le profil"
                                            >
                                                <UserIcon className="w-4 h-4" />
                                                Profil
                                            </button>
                                            <button
                                                onClick={() => deleteParticipant(participant.id, participant.username)}
                                                disabled={deletingId === participant.id}
                                                className="text-red-600 hover:text-red-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Supprimer du tournoi"
                                            >
                                                {deletingId === participant.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                                Supprimer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredParticipants.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        Aucun participant trouvé
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
