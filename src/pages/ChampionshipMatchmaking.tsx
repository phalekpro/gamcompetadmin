import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, getDoc, collection, getDocs, query, where, 
  writeBatch, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, ChampionshipStats } from '../types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Shuffle, Users, AlertTriangle,
  BarChart2, Zap, Settings, RefreshCw, Trash2,
  X, ChevronRight, Clock, CheckCircle, AlertCircle
} from 'lucide-react';

// ─── Types locaux ────────────────────────────────────────────────────────────

interface ParticipantPreview {
  id: string;
  username: string;
  avatarUrl: string;
  registeredAt: any;
}

interface InternalStats {
  assignedCount: number;
  opponentCounts: Record<string, number>;
}

interface ScheduleMatch {
  id: string;
  opponentId: string;
  opponentUsername: string;
  opponentAvatar: string;
  matchNumber: number;
  status: string;
  result?: string | null;
  isPlayer1: boolean;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ChampionshipMatchmaking() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<ParticipantPreview[]>([]);
  const [playerStats, setPlayerStats] = useState<ChampionshipStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Planning d'un joueur
  const [selectedPlayer, setSelectedPlayer] = useState<ParticipantPreview | null>(null);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Matchmaking parameters
  const [maxMatches, setMaxMatches] = useState(30);
  const [maxVsOpponent, setMaxVsOpponent] = useState(10);
  const [pointsWin, setPointsWin] = useState(3);
  const [pointsDraw, setPointsDraw] = useState(1);
  const [pointsLoss, setPointsLoss] = useState(0);

  const matchmakingDone = tournament?.matchmakingDoneChampionship ?? false;

  // Simulation : calcule le nombre de matchs atteignables avec les paramètres actuels
  const simulate = (nPlayers: number, maxPerPlayer: number, maxVsOpp: number) => {
    if (nPlayers < 2) return { matchesPerPlayer: 0, totalMatches: 0, reachable: false };
    const theoreticalMax = (nPlayers - 1) * maxVsOpp;
    const reachable = theoreticalMax >= maxPerPlayer;
    const matchesPerPlayer = Math.min(maxPerPlayer, theoreticalMax);
    // Total matchs = (joueurs × matchs/joueur) / 2 (chaque match compte pour 2 joueurs)
    const totalMatches = Math.floor((nPlayers * matchesPerPlayer) / 2);
    return { matchesPerPlayer, totalMatches, reachable };
  };

  const sim = simulate(participants.length, maxMatches, maxVsOpponent);

  useEffect(() => {
    if (tournamentId) loadData();
  }, [tournamentId]);

  const loadData = async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      // Tournoi
      const tournSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournSnap.exists()) {
        toast.error('Championnat introuvable');
        navigate('/tournaments');
        return;
      }
      const t = { id: tournSnap.id, ...tournSnap.data() } as Tournament;
      setTournament(t);
      
      // Sync local states
      setMaxMatches(t.maxMatchesPerPlayer ?? 30);
      setMaxVsOpponent(t.maxMatchesVsOpponent ?? 10);
      setPointsWin(t.pointsSystem?.win ?? 3);
      setPointsDraw(t.pointsSystem?.draw ?? 1);
      setPointsLoss(t.pointsSystem?.loss ?? 0);

      // Stats
      const statsSnap = await getDocs(
        query(collection(db, 'championship_stats'), where('tournamentId', '==', tournamentId))
      );
      setPlayerStats(statsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChampionshipStats)));

      // Participants
      const partIds: string[] = t.participants ?? [];
      if (partIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < partIds.length; i += 10) chunks.push(partIds.slice(i, i + 10));
        
        const snapshots = await Promise.all(
          chunks.map(chunk => getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk))))
        );

        const all: ParticipantPreview[] = [];
        snapshots.forEach(snap => {
          snap.docs.forEach(d => all.push({
            id: d.id,
            username: d.data().username,
            avatarUrl: d.data().avatarUrl,
            registeredAt: t.participantsData?.[d.id]?.registeredAt
          }));
        });
        
        all.sort((a, b) => a.username.localeCompare(b.username));
        setParticipants(all);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!tournamentId) return;
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        maxMatchesPerPlayer: maxMatches,
        maxMatchesVsOpponent: maxVsOpponent,
        pointsSystem: { win: pointsWin, draw: pointsDraw, loss: pointsLoss },
        updatedAt: serverTimestamp()
      });
      toast.success('Paramètres mis à jour');
      setShowSettings(false);
      loadData();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleResetMatchmaking = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir réinitialiser TOUT le matchmaking ? Cela supprimera tous les matchs et toutes les stats en cours. CETTE ACTION EST IRRÉVERSIBLE.')) return;
    
    setGenerating(true);
    try {
      const matchSnap = await getDocs(query(collection(db, 'championship_matches'), where('tournamentId', '==', tournamentId)));
      const statsSnap = await getDocs(query(collection(db, 'championship_stats'), where('tournamentId', '==', tournamentId)));
      
      const batch = writeBatch(db);
      matchSnap.docs.forEach(d => batch.delete(d.ref));
      statsSnap.docs.forEach(d => batch.delete(d.ref));
      
      batch.update(doc(db, 'tournaments', tournamentId!), {
        matchmakingDoneChampionship: false,
        matchmakingGeneratedAt: null,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      toast.success('Matchmaking réinitialisé');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async (incremental = false) => {
    if (!tournamentId || !tournament) return;
    if (participants.length < 2) {
      toast.error('Il faut au moins 2 participants');
      return;
    }
    setGenerating(true);
    try {
      // 1. Charger TOUS les matchs existants pour reconstruire les compteurs réels
      const matchSnap = await getDocs(query(
        collection(db, 'championship_matches'),
        where('tournamentId', '==', tournamentId)
      ));

      // 2. Préparer les données des joueurs
      const players = participants.map((p, idx) => ({
        userId: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        registeredAt: p.registeredAt || new Date(),
        registrationOrder: idx
      }));

      // 3. Reconstruire les compteurs réels depuis les matchs Firestore
      //    (source de vérité — pas les stats qui peuvent être désynchronisées)
      const stats: Record<string, InternalStats> = {};
      players.forEach(p => {
        stats[p.userId] = { assignedCount: 0, opponentCounts: {} };
      });

      matchSnap.docs.forEach(d => {
        const data = d.data();
        const p1 = data.player1Id as string;
        const p2 = data.player2Id as string;
        // On ne compte que les matchs impliquant des joueurs encore participants
        if (!stats[p1] || !stats[p2]) return;
        stats[p1].assignedCount++;
        stats[p2].assignedCount++;
        stats[p1].opponentCounts[p2] = (stats[p1].opponentCounts[p2] ?? 0) + 1;
        stats[p2].opponentCounts[p1] = (stats[p2].opponentCounts[p1] ?? 0) + 1;
      });

      // 4. Générer uniquement les matchs MANQUANTS
      const assignments: Array<{ p1: string; p2: string }> = [];

      const tryAddMatch = (p1Id: string, p2Id: string) => {
        if (!stats[p1Id] || !stats[p2Id]) return false;
        if (stats[p1Id].assignedCount >= maxMatches) return false;
        if (stats[p2Id].assignedCount >= maxMatches) return false;
        if ((stats[p1Id].opponentCounts[p2Id] ?? 0) >= maxVsOpponent) return false;
        if ((stats[p2Id].opponentCounts[p1Id] ?? 0) >= maxVsOpponent) return false;

        assignments.push({ p1: p1Id, p2: p2Id });
        stats[p1Id].assignedCount++;
        stats[p2Id].assignedCount++;
        stats[p1Id].opponentCounts[p2Id] = (stats[p1Id].opponentCounts[p2Id] ?? 0) + 1;
        stats[p2Id].opponentCounts[p1Id] = (stats[p2Id].opponentCounts[p1Id] ?? 0) + 1;
        return true;
      };

      // Phase 1 : Round Robin — s'assure que chaque paire a joué au moins 1 fois
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          tryAddMatch(players[i].userId, players[j].userId);
        }
      }

      // Phase 2 : Remplissage jusqu'à maxMatches — boucle jusqu'à saturation
      let progress = true;
      while (progress) {
        progress = false;
        const sorted = [...players].sort(
          (a, b) => stats[a.userId].assignedCount - stats[b.userId].assignedCount
        );
        for (const player of sorted) {
          if (stats[player.userId].assignedCount >= maxMatches) continue;
          const candidates = players
            .filter(p => p.userId !== player.userId)
            .filter(p => stats[p.userId].assignedCount < maxMatches)
            .filter(p => (stats[player.userId].opponentCounts[p.userId] ?? 0) < maxVsOpponent)
            .sort((a, b) => {
              const aC = stats[player.userId].opponentCounts[a.userId] ?? 0;
              const bC = stats[player.userId].opponentCounts[b.userId] ?? 0;
              if (aC !== bC) return aC - bC;
              return stats[a.userId].assignedCount - stats[b.userId].assignedCount;
            });
          if (candidates.length > 0 && tryAddMatch(player.userId, candidates[0].userId)) {
            progress = true;
          }
        }
      }

      if (assignments.length === 0) {
        toast.success('Tous les matchs sont déjà générés — rien à ajouter.');
        setGenerating(false);
        return;
      }

      // 5. Écriture Firestore en batches
      const batch = writeBatch(db);

      assignments.forEach(assign => {
        const p1 = players.find(p => p.userId === assign.p1)!;
        const p2 = players.find(p => p.userId === assign.p2)!;
        const matchRef = doc(collection(db, 'championship_matches'));
        batch.set(matchRef, {
          tournamentId,
          player1Id: p1.userId,
          player2Id: p2.userId,
          player1Username: p1.username,
          player2Username: p2.username,
          player1Avatar: p1.avatarUrl,
          player2Avatar: p2.avatarUrl,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // Mise à jour des stats (toujours basée sur les compteurs reconstruits)
      players.forEach(p => {
        const s = stats[p.userId];
        const statsRef = doc(db, 'championship_stats', `${tournamentId}_${p.userId}`);
        const existing = playerStats.find(ps => ps.userId === p.userId);
        batch.set(statsRef, {
          tournamentId,
          userId: p.userId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          points:           existing?.points ?? 0,
          wins:             existing?.wins ?? 0,
          draws:            existing?.draws ?? 0,
          losses:           existing?.losses ?? 0,
          matchesPlayed:    existing?.matchesPlayed ?? 0,
          matchesAssigned:  s.assignedCount,
          matchesRemaining: Math.max(0, s.assignedCount - (existing?.matchesPlayed ?? 0)),
          performanceRatio: existing?.performanceRatio ?? 0,
          assignedOpponents: Object.keys(s.opponentCounts),
          opponentMatchCount: s.opponentCounts,
          playerStatus: existing?.playerStatus ?? 'active',
          registeredAt: p.registeredAt,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      batch.update(doc(db, 'tournaments', tournamentId), {
        matchmakingDoneChampionship: true,
        matchmakingGeneratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      const newWarnings: string[] = [];
      players.forEach(p => {
        if (stats[p.userId].assignedCount < maxMatches) {
          newWarnings.push(
            `${p.username} : ${stats[p.userId].assignedCount}/${maxMatches} matchs` +
            ` — augmente "Max vs même adversaire" pour atteindre ${maxMatches}.`
          );
        }
      });
      setWarnings(newWarnings);
      toast.success(`${assignments.length} nouveaux matchs ajoutés !`);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  // ── Planning d'un joueur ──────────────────────────────────────────────────

  const loadPlayerSchedule = async (player: ParticipantPreview) => {
    setSelectedPlayer(player);
    setScheduleLoading(true);
    setSchedule([]);
    try {
      // Récupérer tous les matchs où ce joueur est player1 ou player2
      const [asP1Snap, asP2Snap] = await Promise.all([
        getDocs(query(
          collection(db, 'championship_matches'),
          where('tournamentId', '==', tournamentId),
          where('player1Id', '==', player.id)
        )),
        getDocs(query(
          collection(db, 'championship_matches'),
          where('tournamentId', '==', tournamentId),
          where('player2Id', '==', player.id)
        )),
      ]);

      const matches: ScheduleMatch[] = [];

      asP1Snap.docs.forEach((d, i) => {
        const data = d.data();
        matches.push({
          id: d.id,
          opponentId: data.player2Id,
          opponentUsername: data.player2Username,
          opponentAvatar: data.player2Avatar,
          matchNumber: 0, // sera recalculé
          status: data.status,
          result: data.result ?? null,
          isPlayer1: true,
        });
      });

      asP2Snap.docs.forEach((d) => {
        const data = d.data();
        matches.push({
          id: d.id,
          opponentId: data.player1Id,
          opponentUsername: data.player1Username,
          opponentAvatar: data.player1Avatar,
          matchNumber: 0,
          status: data.status,
          result: data.result ?? null,
          isPlayer1: false,
        });
      });

      // Numéroter les matchs et trier par adversaire puis par ordre d'insertion
      matches.forEach((m, i) => { m.matchNumber = i + 1; });

      // Trier : matchs joués en bas, pending en haut
      matches.sort((a, b) => {
        const order: Record<string, number> = { pending: 0, awaiting_validation: 1, validated: 2, rejected: 3, disputed: 4 };
        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
      });

      setSchedule(matches);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement du planning');
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Calculs pour la visualisation ──
  const totalMatches = playerStats.reduce((a, s) => a + (s.matchesAssigned ?? 0), 0) / 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-wrap items-center gap-6">
        <button
          onClick={() => navigate(`/championships/${tournamentId}`)}
          className="flex items-center justify-center size-12 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition-all active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Matchmaking Championnat</h1>
          <p className="text-gray-500 font-medium">{tournament.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
              showSettings ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            Paramètres
          </button>
          <span className="px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-100">
            🏆 30 JOURS
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="bg-violet-50 rounded-3xl p-8 border-2 border-violet-100">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-violet-600" />
            <h2 className="text-xl font-black text-violet-900 uppercase tracking-wider">Réglages du Matchmaking</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-violet-700">Max Matchs / Joueur</label>
              <input type="number" value={maxMatches} onChange={e => setMaxMatches(Number(e.target.value))} className="w-full bg-white border border-violet-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-violet-200 outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-violet-700">Max vs même adversaire</label>
              <input type="number" value={maxVsOpponent} onChange={e => setMaxVsOpponent(Number(e.target.value))} className="w-full bg-white border border-violet-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-violet-200 outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-violet-700">Système de points (V/N/D)</label>
              <div className="flex gap-2">
                <input type="number" value={pointsWin} onChange={e => setPointsWin(Number(e.target.value))} className="w-full bg-white border border-violet-200 rounded-xl px-2 py-3 text-center font-bold" />
                <input type="number" value={pointsDraw} onChange={e => setPointsDraw(Number(e.target.value))} className="w-full bg-white border border-violet-200 rounded-xl px-2 py-3 text-center font-bold" />
                <input type="number" value={pointsLoss} onChange={e => setPointsLoss(Number(e.target.value))} className="w-full bg-white border border-violet-200 rounded-xl px-2 py-3 text-center font-bold" />
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={handleUpdateSettings} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-violet-200">Appliquer les réglages</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { icon: <Users className="w-6 h-6 text-blue-500" />, label: 'Participants', value: participants.length, sub: `/ ${tournament.maxParticipants}` },
          { icon: <Shuffle className="w-6 h-6 text-orange-500" />, label: 'Matchs / joueur', value: maxMatches, sub: 'définis' },
          { icon: <BarChart2 className="w-6 h-6 text-purple-500" />, label: 'Total Matchs', value: Math.round(totalMatches), sub: 'générés' },
          { icon: <Zap className="w-6 h-6 text-yellow-500" />, label: 'Points', value: `${pointsWin}/${pointsDraw}/${pointsLoss}`, sub: 'système' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 shadow-lg shadow-gray-100 hover:shadow-xl transition-shadow border border-gray-50 group">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-2xl bg-gray-50 uppercase">{card.icon}</div>
              <span className="text-xs text-gray-500 font-black tracking-widest">{card.label}</span>
            </div>
            <p className="text-3xl font-black text-gray-900 flex items-baseline gap-1">
              {card.value}
              <span className="text-xs font-medium text-gray-400 capitalize">{card.sub}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
            <h3 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
              <RefreshCw className={`w-7 h-7 text-violet-600 ${generating ? 'animate-spin' : ''}`} />
              Matchmaking — Mise à jour continue
            </h3>
            <p className="text-gray-600 mb-4 max-w-xl leading-relaxed font-medium">
              Clique à tout moment pour générer les matchs manquants. Les nouveaux participants reçoivent automatiquement leurs adversaires. Les matchs existants ne sont jamais supprimés.
            </p>

            {/* Simulateur en temps réel */}
            <div className={`mb-6 p-5 rounded-2xl border-2 ${sim.reachable ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Simulation avec les paramètres actuels</p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-gray-900">{participants.length}</p>
                  <p className="text-xs text-gray-500">Joueurs</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-black ${sim.reachable ? 'text-green-700' : 'text-amber-700'}`}>{sim.matchesPerPlayer}</p>
                  <p className="text-xs text-gray-500">Matchs/joueur</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-black ${sim.reachable ? 'text-green-700' : 'text-amber-700'}`}>{sim.totalMatches}</p>
                  <p className="text-xs text-gray-500">Total matchs</p>
                </div>
              </div>
              {!sim.reachable && (
                <div className="flex items-start gap-2 text-amber-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Avec {participants.length} joueurs, le max atteignable est{' '}
                    <strong>{(participants.length - 1) * maxVsOpponent} matchs/joueur</strong>.
                    Pour atteindre {maxMatches}, augmente "Max vs même adversaire" à{' '}
                    <strong>{Math.ceil(maxMatches / Math.max(1, participants.length - 1))}</strong> minimum.
                  </span>
                </div>
              )}
              {sim.reachable && (
                <p className="text-green-700 text-xs font-semibold flex items-center gap-1">
                  <span>✓</span> Les {maxMatches} matchs/joueur sont atteignables avec ces paramètres.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => handleGenerate()} 
                disabled={generating || participants.length < 2}
                className="flex-1 min-w-[240px] flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-violet-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Génération en cours...' : 'Mettre à jour le Matchmaking'}
              </button>
              <button onClick={handleResetMatchmaking} disabled={generating} className="px-8 py-5 rounded-2xl font-black text-red-600 bg-red-50 hover:bg-red-100 transition-all flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Tout réinitialiser
              </button>
            </div>
            {warnings.length > 0 && (
              <div className="mt-8 p-5 bg-amber-50 rounded-2xl border-2 border-amber-100">
                <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold"><AlertTriangle className="w-5 h-5" /> Attention</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-sm text-amber-700 font-medium">{w}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-gray-50">
             <h3 className="text-xl font-black text-gray-900 mb-2">Participants ({participants.length})</h3>
             <p className="text-sm text-gray-400 mb-6">Clique sur un joueur pour voir ses {maxMatches} matchs</p>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {participants.map(p => {
                  const stat = playerStats.find(s => s.userId === p.id);
                  const assigned = stat?.matchesAssigned ?? 0;
                  const played = stat?.matchesPlayed ?? 0;
                  const isSelected = selectedPlayer?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => loadPlayerSchedule(p)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98] ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-100'
                          : 'border-transparent bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <img
                        src={p.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username)}&background=7c3aed&color=fff`}
                        className="w-11 h-11 rounded-full border-2 border-white object-cover flex-shrink-0"
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate text-sm">{p.username}</p>
                        {stat ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${assigned >= maxMatches ? 'bg-green-500' : 'bg-violet-500'}`}
                                style={{ width: `${Math.min(100, Math.round((assigned / maxMatches) * 100))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-gray-500 flex-shrink-0">{assigned}/{maxMatches}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-orange-500 uppercase">Pas encore généré</span>
                        )}
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-violet-500' : 'text-gray-300'}`} />
                    </button>
                  );
                })}
             </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Répartition Live */}
          <div className="bg-gray-900 rounded-[2rem] p-8 text-white shadow-2xl overflow-hidden">
             <h3 className="text-xl font-black mb-6 uppercase tracking-widest text-violet-400">Répartition Live</h3>
             <div className="space-y-6">
                {playerStats.sort((a,b) => (b.matchesAssigned ?? 0) - (a.matchesAssigned ?? 0)).slice(0, 8).map(stat => {
                    const assigned = stat.matchesAssigned ?? 0;
                    const pct = Math.round((assigned / maxMatches) * 100);
                    return (
                      <div key={stat.id} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="truncate w-32">{stat.username}</span>
                          <span className={assigned >= maxMatches ? 'text-green-400' : 'text-orange-400'}>{assigned} / {maxMatches}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-1000 ${assigned >= maxMatches ? 'bg-green-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                })}
             </div>
          </div>

          {/* Planning du joueur sélectionné */}
          {selectedPlayer && (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
              {/* Header du panneau */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-violet-50">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedPlayer.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPlayer.username)}&background=7c3aed&color=fff`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-violet-200"
                    alt=""
                  />
                  <div>
                    <p className="font-black text-gray-900 text-sm">{selectedPlayer.username}</p>
                    <p className="text-xs text-violet-600 font-semibold">
                      {scheduleLoading ? 'Chargement...' : `${schedule.length} matchs`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPlayer(null); setSchedule([]); }}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Compteurs rapides */}
              {!scheduleLoading && schedule.length > 0 && (() => {
                const pending   = schedule.filter(m => m.status === 'pending').length;
                const waiting   = schedule.filter(m => m.status === 'awaiting_validation').length;
                const validated = schedule.filter(m => m.status === 'validated').length;
                const disputed  = schedule.filter(m => m.status === 'disputed').length;
                return (
                  <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                    {[
                      { label: 'À jouer', value: pending,   color: 'text-gray-600' },
                      { label: 'En attente', value: waiting, color: 'text-amber-600' },
                      { label: 'Validés', value: validated, color: 'text-green-600' },
                      { label: 'Litiges', value: disputed,  color: 'text-red-500' },
                    ].map(c => (
                      <div key={c.label} className="py-3 text-center">
                        <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
                        <p className="text-[10px] text-gray-400 font-semibold">{c.label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Liste des matchs */}
              <div className="overflow-y-auto max-h-[520px]">
                {scheduleLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                  </div>
                ) : schedule.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Shuffle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">Aucun match généré pour ce joueur</p>
                    <p className="text-xs mt-1">Lance le matchmaking d'abord</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {schedule.map((m, idx) => {
                      const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                        pending:              { icon: <Clock className="w-3.5 h-3.5" />,        color: 'text-gray-400 bg-gray-50',    label: 'À jouer' },
                        awaiting_validation:  { icon: <AlertCircle className="w-3.5 h-3.5" />,  color: 'text-amber-600 bg-amber-50',  label: 'En attente' },
                        validated:            { icon: <CheckCircle className="w-3.5 h-3.5" />,  color: 'text-green-600 bg-green-50',  label: 'Validé' },
                        rejected:             { icon: <X className="w-3.5 h-3.5" />,            color: 'text-red-500 bg-red-50',      label: 'Rejeté' },
                        disputed:             { icon: <AlertTriangle className="w-3.5 h-3.5" />,color: 'text-red-600 bg-red-50',      label: 'Litige' },
                      };
                      const cfg = statusConfig[m.status] ?? statusConfig.pending;

                      // Résultat du point de vue du joueur sélectionné
                      let resultLabel = '';
                      let resultColor = '';
                      if (m.result) {
                        const won = (m.isPlayer1 && m.result === 'player1_win') || (!m.isPlayer1 && m.result === 'player2_win');
                        const draw = m.result === 'draw';
                        resultLabel = draw ? 'Nul' : won ? 'Victoire' : 'Défaite';
                        resultColor = draw ? 'text-blue-600' : won ? 'text-green-600' : 'text-red-500';
                      }

                      return (
                        <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                          {/* Numéro */}
                          <span className="text-xs font-black text-gray-300 w-6 flex-shrink-0 text-right">
                            {idx + 1}
                          </span>

                          {/* Avatar adversaire */}
                          <img
                            src={m.opponentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.opponentUsername)}&background=6366f1&color=fff`}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100"
                            alt=""
                          />

                          {/* Nom adversaire */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{m.opponentUsername}</p>
                            {resultLabel && (
                              <p className={`text-xs font-semibold ${resultColor}`}>{resultLabel}</p>
                            )}
                          </div>

                          {/* Badge statut */}
                          <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
