import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Shuffle, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { calculateTournamentRounds, getRoundDisplayName } from '../utils/bracketUtils';

interface Participant {
  id: string;
  username: string;
  avatarUrl: string;
}

export default function TournamentMatchMaking() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId]);

  const loadTournamentData = async () => {
    if (!tournamentId) return;

    try {
      // Charger le tournoi
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentDoc.exists()) {
        toast.error('Tournoi introuvable');
        navigate('/tournaments');
        return;
      }

      const tournamentData = { id: tournamentDoc.id, ...tournamentDoc.data() } as Tournament;
      setTournament(tournamentData);

      // Charger les participants
      if (tournamentData.participants && tournamentData.participants.length > 0) {
        const participantsQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', tournamentData.participants.slice(0, 10)) // Firestore limite à 10
        );
        const participantsSnapshot = await getDocs(participantsQuery);
        const participantsData = participantsSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username,
          avatarUrl: doc.data().avatarUrl
        }));
        setParticipants(participantsData);
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateMatchMaking = async () => {
    if (!tournament || !tournamentId) return;

    // Vérifier qu'il y a assez de participants
    if (tournament.currentParticipants < 2) {
      toast.error('Il faut au moins 2 participants pour générer les matchs');
      return;
    }

    // Note: Re-generation is allowed at all times as per user request.
    // A warning will be shown in the UI if already done.

    try {
      setGenerating(true);

      // Mélanger les participants aléatoirement
      const shuffledParticipants = shuffleArray([...tournament.participants]);

      // Calculer les tours
      const rounds = calculateTournamentRounds(tournament.maxParticipants);
      const firstRound = rounds[0];

      if (!firstRound) {
        toast.error('Impossible de calculer les tours');
        return;
      }

      // Créer une copie du bracket
      const updatedBracket = { ...tournament.bracket };
      
      // Remplir le premier tour avec les participants
      const firstRoundMatches = updatedBracket.rounds[firstRound.key];
      
      for (let i = 0; i < firstRoundMatches.length; i++) {
        const player1Index = i * 2;
        const player2Index = i * 2 + 1;

        // Player 1
        if (player1Index < shuffledParticipants.length) {
          const player1Id = shuffledParticipants[player1Index];
          // Récupérer les infos du joueur depuis Firestore
          const player1Doc = await getDoc(doc(db, 'users', player1Id));
          if (player1Doc.exists()) {
            firstRoundMatches[i].player1 = {
              id: player1Id,
              username: player1Doc.data().username,
              avatar: player1Doc.data().avatarUrl || 'https://picsum.photos/200'
            };
          }
        }

        // Player 2
        if (player2Index < shuffledParticipants.length) {
          const player2Id = shuffledParticipants[player2Index];
          // Récupérer les infos du joueur depuis Firestore
          const player2Doc = await getDoc(doc(db, 'users', player2Id));
          if (player2Doc.exists()) {
            firstRoundMatches[i].player2 = {
              id: player2Id,
              username: player2Doc.data().username,
              avatar: player2Doc.data().avatarUrl || 'https://picsum.photos/201'
            };
          }
        }

        // Si un des joueurs manque, mettre "Pas encore déterminé"
        if (!firstRoundMatches[i].player1) {
          firstRoundMatches[i].player1 = null;
        }
        if (!firstRoundMatches[i].player2) {
          firstRoundMatches[i].player2 = null;
        }
      }

      // Marquer le match making comme fait
      updatedBracket.matchMakingDone = true;
      updatedBracket.rounds[firstRound.key] = firstRoundMatches;

      // Mettre à jour le tournoi dans Firestore
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        bracket: updatedBracket,
        status: 'in_progress'
      });

      toast.success(`Match making effectué! ${firstRoundMatches.length} matchs générés pour le ${firstRound.name}`);
      
      // Recharger les données
      await loadTournamentData();
      
      // Rediriger vers le bracket
      setTimeout(() => {
        navigate(`/tournaments/${tournamentId}/bracket`);
      }, 2000);

    } catch (error) {
      console.error('Error generating match making:', error);
      toast.error('Erreur lors de la génération des matchs');
    } finally {
      setGenerating(false);
    }
  };

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

  const rounds = calculateTournamentRounds(tournament.maxParticipants);
  const firstRound = rounds[0];
  const matchMakingDone = tournament.bracket?.matchMakingDone || false;

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
          <h1 className="text-3xl font-bold text-gray-900">Match Making</h1>
          <p className="text-gray-500 mt-1">{tournament.name}</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-gray-600">Participants</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {tournament.currentParticipants} / {tournament.maxParticipants}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shuffle className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-gray-600">Premier Tour</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {firstRound ? getRoundDisplayName(firstRound.key) : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {firstRound ? `${firstRound.matchCount} matchs` : ''}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-gray-600">Statut</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {matchMakingDone ? (
                <span className="text-green-600">Effectué</span>
              ) : (
                <span className="text-orange-600">En attente</span>
              )}
            </p>
          </div>
        </div>

        {matchMakingDone && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-900">Attention : Matchmaking déjà effectué</p>
              <p className="text-sm text-amber-700">
                La régénération du matchmaking supprimera le bracket actuel et réinitialisera tous les scores. 
                Ne faites cela que si nécessaire.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!matchMakingDone && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📋 Instructions</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Le système va mélanger aléatoirement tous les participants inscrits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Les matchs du premier tour ({firstRound?.name}) seront générés automatiquement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Les joueurs seront appariés 2 par 2 pour créer {firstRound?.matchCount} matchs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Les tours suivants se rempliront automatiquement au fur et à mesure des victoires</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">5.</span>
              <span>Le tournoi passera automatiquement en statut "En cours"</span>
            </li>
          </ul>
        </div>
      )}

      {/* Already Done */}
      {matchMakingDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-bold text-green-900">Match Making Effectué</h3>
          </div>
          <p className="text-sm text-green-800 mb-4">
            Les matchs du premier tour ont déjà été générés. Vous pouvez consulter le bracket pour voir tous les matchs.
          </p>
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Voir le Bracket
          </button>
        </div>
      )}

      {/* Action Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {matchMakingDone ? 'Modifier le Match Making ?' : 'Prêt à générer les matchs ?'}
          </h3>
          <p className="text-gray-600 mb-6">
            {matchMakingDone 
              ? 'Cette action va réinitialiser tout le bracket et mélanger à nouveau les participants.' 
              : 'Cette action va créer tous les matchs du premier tour et démarrer le tournoi.'}
          </p>
          <button
            onClick={generateMatchMaking}
            disabled={generating || tournament.currentParticipants < 2}
            className={`inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              matchMakingDone 
                ? 'bg-amber-500 hover:bg-amber-600' 
                : 'bg-primary hover:bg-primary/90'
            } text-white`}
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Génération en cours...</span>
              </>
            ) : (
              <>
                <Shuffle className="w-6 h-6" />
                <span>{matchMakingDone ? 'Régénérer le Match Making' : 'Générer le Match Making'}</span>
              </>
            )}
          </button>
          {tournament.currentParticipants < 2 && (
            <p className="text-sm text-red-600 mt-3">
              Il faut au moins 2 participants pour générer les matchs
            </p>
          )}
        </div>
      </div>

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Participants Inscrits ({tournament.currentParticipants})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <img
                  src={participant.avatarUrl}
                  alt={participant.username}
                  className="size-10 rounded-full"
                />
                <span className="font-medium text-sm truncate">{participant.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
