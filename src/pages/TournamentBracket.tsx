import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament } from '../types';
import { ArrowLeft } from 'lucide-react';

export default function TournamentBracket() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState(0);

  useEffect(() => {
    const loadTournament = async () => {
      if (!tournamentId) return;
      
      try {
        const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
        if (tournamentDoc.exists()) {
          setTournament({ id: tournamentDoc.id, ...tournamentDoc.data() } as Tournament);
        }
      } catch (error) {
        console.error('Error loading tournament:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTournament();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Tournoi introuvable</p>
        <button onClick={() => navigate('/tournaments')} className="text-primary hover:underline">
          Retour aux tournois
        </button>
      </div>
    );
  }

  const rounds = tournament.bracket?.rounds ? Object.keys(tournament.bracket.rounds) : [];
  const currentRoundKey = rounds[activeRound];
  const currentMatches = tournament.bracket?.rounds?.[currentRoundKey] || [];

  const getRoundName = (roundKey: string) => {
    const names: { [key: string]: string } = {
      'round_of_128': '1er Tour',
      'round_of_64': '2ème Tour',
      'round_of_32': '3ème Tour',
      'round_of_16': '16èmes',
      'round_of_8': '8èmes',
      'quarter_finals': 'Quarts',
      'semi_finals': 'Demi',
      'grand_final': 'Finale'
    };
    return names[roundKey] || roundKey;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finished':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">Terminé</span>;
      case 'live':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded flex items-center gap-1">
          <span className="size-1.5 bg-blue-600 rounded-full animate-pulse"></span>
          En cours
        </span>;
      case 'scheduled':
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded">À venir</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tournaments')}
          className="flex items-center justify-center size-10 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">
            Prize Pool: {(tournament.prizePool || 0).toLocaleString()} FCFA • {tournament.currentParticipants}/{tournament.maxParticipants} joueurs
          </p>
        </div>
      </div>

      {/* Tabs */}
      {rounds.length > 0 ? (
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 overflow-x-auto">
            {rounds.map((roundKey, idx) => (
              <button
                key={roundKey}
                onClick={() => setActiveRound(idx)}
                className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  idx === activeRound
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {getRoundName(roundKey)}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-amber-800 font-medium">Le bracket n'a pas encore été généré pour ce tournoi.</p>
          <button 
            onClick={() => navigate(`/tournaments/${tournament.id}/matchmaking`)}
            className="mt-4 bg-primary text-white px-6 py-2 rounded-lg font-bold"
          >
            Aller au Matchmaking
          </button>
        </div>
      )}

      {/* Matches */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMatches.map((match: any) => (
          <div key={match.matchNumber} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            {/* Match Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-500">Match {match.matchNumber}</span>
              {getStatusBadge(match.status)}
            </div>

            {/* Players */}
            <div className="space-y-2">
              {/* Player 1 */}
              <div className={`flex items-center justify-between p-2 rounded ${
                match.winnerId === match.player1?.id ? 'bg-green-50' : ''
              }`}>
                <div className="flex items-center gap-2">
                  {match.player1 ? (
                    <>
                      <img 
                        src={match.player1.avatar} 
                        alt={match.player1.username}
                        className="size-8 rounded-full"
                      />
                      <span className="font-medium">{match.player1.username}</span>
                    </>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Pas encore déterminé</span>
                  )}
                </div>
                {match.player1?.score !== undefined && (
                  <span className={`font-bold ${
                    match.winnerId === match.player1?.id ? 'text-green-600' : ''
                  }`}>
                    {match.player1.score}
                  </span>
                )}
              </div>

              {/* Player 2 */}
              <div className={`flex items-center justify-between p-2 rounded ${
                match.winnerId === match.player2?.id ? 'bg-green-50' : ''
              }`}>
                <div className="flex items-center gap-2">
                  {match.player2 ? (
                    <>
                      <img 
                        src={match.player2.avatar} 
                        alt={match.player2.username}
                        className="size-8 rounded-full"
                      />
                      <span className="font-medium">{match.player2.username}</span>
                    </>
                  ) : (
                    <span className="text-gray-400 italic text-sm">Pas encore déterminé</span>
                  )}
                </div>
                {match.player2?.score !== undefined && (
                  <span className={`font-bold ${
                    match.winnerId === match.player2?.id ? 'text-green-600' : ''
                  }`}>
                    {match.player2.score}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {currentMatches.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">Aucun match dans ce tour</p>
        </div>
      )}
    </div>
  );
}
