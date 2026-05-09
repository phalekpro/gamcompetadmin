import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Match } from '../types';
import toast from 'react-hot-toast';
import { Eye, CheckCircle } from 'lucide-react';

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const qStandard = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(50));
      const qChampionship = query(collection(db, 'championship_matches'), orderBy('createdAt', 'desc'), limit(50));
      
      const [snapStandard, snapChampionship] = await Promise.all([
        getDocs(qStandard),
        getDocs(qChampionship)
      ]);
      
      const standardMatches = snapStandard.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isChampionship: false
      } as Match));
      
      const championshipMatches = snapChampionship.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isChampionship: true,
        // Adapt fields if necessary
        scheduledTime: (doc.data() as any).createdAt, 
        round: 'Championnat'
      } as any));
      
      const allMatches = [...standardMatches, ...championshipMatches].sort((a, b) => {
        const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return t2 - t1;
      });
      
      setMatches(allMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const validateMatch = async (matchId: string, winnerId: string) => {
    const selectedMatchObj = matches.find(m => m.id === matchId);
    try {
      if (selectedMatchObj?.isChampionship) {
        // Validation via Backend pour les championnats
        const result = winnerId === selectedMatchObj.player1Id ? 'player1_win' : 'player2_win';
        const tournamentId = selectedMatchObj.tournamentId;
        
        const BACKEND_URL = (import.meta as any).env.VITE_BACKEND_URL ?? 'http://localhost:3001';
        const res = await fetch(`${BACKEND_URL}/api/championships/${tournamentId}/matches/${matchId}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result, adminId: 'admin' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur API Backend');
        
        toast.success('Match de championnat validé');
      } else {
        // Validation standard
        await updateDoc(doc(db, 'matches', matchId), {
          winnerId,
          status: 'completed',
          adminReview: {
            reviewed: true,
            reviewedAt: serverTimestamp(),
            decision: 'Manual validation by admin'
          },
          updatedAt: serverTimestamp(),
        });
        toast.success('Match validé');
      }

      setMatches(matches.map(m => 
        m.id === matchId ? { ...m, winnerId, status: 'completed' as const } : m
      ));
      setSelectedMatch(null);
      fetchMatches(); // Refresh list
    } catch (error: any) {
      console.error('Error validating match:', error);
      toast.error(error.message || 'Erreur lors de la validation');
    }
  };

  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'disputed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matchs</h1>
        <p className="text-gray-500 mt-1">{matches.length} matchs</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Round</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Résultats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {matches.map((match) => (
                <tr key={match.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <img src={match.player1Avatar} alt="" className="w-8 h-8 rounded-full" />
                        <span className="font-medium">{match.player1Username}</span>
                      </div>
                      <span className="text-gray-400">vs</span>
                      <div className="flex items-center gap-2">
                        <img src={match.player2Avatar} alt="" className="w-8 h-8 rounded-full" />
                        <span className="font-medium">{match.player2Username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{match.round}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 text-sm">
                      <span className={match.player1Result === 'win' ? 'text-green-600 font-medium' : 'text-gray-500'}>
                        P1: {match.player1Result || 'N/A'}
                      </span>
                      <span className={match.player2Result === 'win' ? 'text-green-600 font-medium' : 'text-gray-500'}>
                        P2: {match.player2Result || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                      {match.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedMatch(match)}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Détails du Match</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img src={selectedMatch.player1Avatar} alt="" className="w-16 h-16 rounded-full mx-auto mb-2" />
                  <p className="text-center font-medium">{selectedMatch.player1Username}</p>
                  <p className="text-center text-sm text-gray-500">Résultat: {selectedMatch.player1Result || 'N/A'}</p>
                  {selectedMatch.player1ProofUrl && (
                    <a 
                      href={selectedMatch.player1ProofUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block mt-2 text-center text-sm text-primary hover:underline"
                    >
                      Voir preuve
                    </a>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img src={selectedMatch.player2Avatar} alt="" className="w-16 h-16 rounded-full mx-auto mb-2" />
                  <p className="text-center font-medium">{selectedMatch.player2Username}</p>
                  <p className="text-center text-sm text-gray-500">Résultat: {selectedMatch.player2Result || 'N/A'}</p>
                  {selectedMatch.player2ProofUrl && (
                    <a 
                      href={selectedMatch.player2ProofUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block mt-2 text-center text-sm text-primary hover:underline"
                    >
                      Voir preuve
                    </a>
                  )}
                </div>
              </div>

              {selectedMatch.status === 'disputed' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium mb-3">Match en litige - Validation manuelle requise</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => validateMatch(selectedMatch.id, selectedMatch.player1Id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Victoire Player 1
                    </button>
                    <button
                      onClick={() => validateMatch(selectedMatch.id, selectedMatch.player2Id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Victoire Player 2
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedMatch(null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
