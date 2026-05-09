import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, query, where,
  onSnapshot, orderBy, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, ChampionshipMatch, ChampionshipStats } from '../types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, Shuffle, Trophy, CheckCircle, XCircle,
  Clock, Search, BarChart2, ShieldAlert
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'https://us-central1-gamecompet-6f5e9.cloudfunctions.net/api';

type Tab = 'participants' | 'matches' | 'validation' | 'leaderboard';
type MatchStatusFilter = 'all' | 'pending' | 'awaiting_validation' | 'validated' | 'rejected' | 'disputed';

export default function ChampionshipDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tab, setTab] = useState<Tab>('participants');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Data
  const [stats, setStats] = useState<ChampionshipStats[]>([]);
  const [matches, setMatches] = useState<ChampionshipMatch[]>([]);
  const [matchFilter, setMatchFilter] = useState<MatchStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (tournamentId) loadTournament();
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    // Abonnement temps réel aux stats
    const unsub = onSnapshot(
      query(collection(db, 'championship_stats'), where('tournamentId', '==', tournamentId)),
      snap => setStats(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChampionshipStats)))
    );
    // Abonnement aux matchs (limité aux 200 plus récents pour la performance)
    const matchesQuery = query(
      collection(db, 'championship_matches'),
      where('tournamentId', '==', tournamentId),
      orderBy('updatedAt', 'desc'),
      limit(200)
    );
    const unsubMatches = onSnapshot(
      matchesQuery,
      snap => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChampionshipMatch)))
    );
    return () => { unsub(); unsubMatches(); };
  }, [tournamentId]);

  const loadTournament = async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!snap.exists()) { navigate('/tournaments'); return; }
      setTournament({ id: snap.id, ...snap.data() } as Tournament);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  // ── Actions Admin ──────────────────────────────────────────────────────────

  const validateMatch = async (match: ChampionshipMatch, result: 'player1_win' | 'player2_win' | 'draw') => {
    setActionLoading(match.id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/championships/${tournamentId}/matches/${match.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, adminId: 'admin' })
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error); return; }
      toast.success('Match validé ✅');
    } catch { toast.error('Erreur réseau'); }
    finally { setActionLoading(null); }
  };

  const rejectMatch = async (matchId: string) => {
    const reason = prompt('Raison du rejet :');
    if (!reason) return;
    setActionLoading(matchId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/championships/${tournamentId}/matches/${matchId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, adminId: 'admin' })
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error); return; }
      toast.success('Match rejeté');
    } catch { toast.error('Erreur réseau'); }
    finally { setActionLoading(null); }
  };

  const changePlayerStatus = async (userId: string, newStatus: 'active' | 'finished' | 'suspended') => {
    setActionLoading(userId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/championships/${tournamentId}/players/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error); return; }
      toast.success(`Statut mis à jour : ${newStatus}`);
    } catch { toast.error('Erreur réseau'); }
    finally { setActionLoading(null); }
  };

  // ── Filtres ────────────────────────────────────────────────────────────────

  const filteredMatches = matches.filter(m => {
    const matchesStatus = matchFilter === 'all' || m.status === matchFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      m.player1Username?.toLowerCase().includes(term) ||
      m.player2Username?.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const pendingValidations = matches.filter(m => m.status === 'awaiting_validation');
  const leaderboard = [...stats].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.performanceRatio - a.performanceRatio;
  });

  // ── Helpers UI ─────────────────────────────────────────────────────────────

  const statusBadge = (status: ChampionshipMatch['status']) => {
    const map = {
      pending: 'bg-gray-100 text-gray-600',
      awaiting_validation: 'bg-amber-100 text-amber-700',
      validated: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      disputed: 'bg-purple-100 text-purple-700',
    };
    const labels = {
      pending: 'Non joué',
      awaiting_validation: 'En attente',
      validated: 'Validé',
      rejected: 'Rejeté',
      disputed: 'Litige',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const playerStatusBadge = (status: ChampionshipStats['playerStatus']) => {
    const map = {
      active: 'bg-green-100 text-green-700',
      finished: 'bg-blue-100 text-blue-700',
      suspended: 'bg-red-100 text-red-700',
    };
    const labels = { active: 'Actif', finished: 'Terminé', suspended: 'Suspendu' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!tournament) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'participants', label: 'Participants', icon: <Users className="w-4 h-4" />, badge: stats.length },
    { id: 'matches', label: 'Matchs', icon: <BarChart2 className="w-4 h-4" />, badge: matches.length },
    { id: 'validation', label: 'Validation', icon: <ShieldAlert className="w-4 h-4" />, badge: pendingValidations.length },
    { id: 'leaderboard', label: 'Classement', icon: <Trophy className="w-4 h-4" /> },
  ];

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
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{tournament.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-500">{tournament.game}</span>
            <span className="text-gray-300">•</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
              🏆 Championnat 30 jours
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate(`/championships/${tournamentId}/matchmaking`)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            tournament.matchmakingDoneChampionship 
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200' 
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          <Shuffle className="w-4 h-4" />
          {tournament.matchmakingDoneChampionship ? 'Gérer le Matchmaking' : 'Matchmaking'}
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Joueurs', value: stats.length, icon: <Users className="w-5 h-5 text-blue-500" />, color: 'blue' },
          { label: 'Matchs validés', value: matches.filter(m => m.status === 'validated').length, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: 'green' },
          { label: 'En attente', value: pendingValidations.length, icon: <Clock className="w-5 h-5 text-amber-500" />, color: 'amber' },
          { label: 'Total matchs', value: matches.length, icon: <BarChart2 className="w-5 h-5 text-violet-500" />, color: 'violet' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-gray-500">{s.label}</span></div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-violet-600 text-violet-700 bg-violet-50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  t.id === 'validation' && t.badge > 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── TAB: Participants ─────────────────────────────────────────── */}
          {tab === 'participants' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Rang</th>
                      <th className="px-4 py-3 text-left">Joueur</th>
                      <th className="px-4 py-3 text-center">Pts</th>
                      <th className="px-4 py-3 text-center">V / N / D</th>
                      <th className="px-4 py-3 text-center">Joués</th>
                      <th className="px-4 py-3 text-center">Restants</th>
                      <th className="px-4 py-3 text-center">Ratio</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaderboard.map((s, idx) => (
                      <tr key={s.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-500">#{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={s.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.username)}&background=7c3aed&color=fff`}
                              alt={s.username}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="font-semibold text-gray-800">{s.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-violet-700">{s.points}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{s.wins}V / {s.draws}N / {s.losses}D</td>
                        <td className="px-4 py-3 text-center">{s.matchesPlayed}</td>
                        <td className="px-4 py-3 text-center">{s.matchesRemaining}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-14 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 bg-violet-500 rounded-full"
                                style={{ width: `${Math.round(s.performanceRatio * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{Math.round(s.performanceRatio * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{playerStatusBadge(s.playerStatus)}</td>
                        <td className="px-4 py-3">
                          <select
                            disabled={actionLoading === s.userId}
                            value={s.playerStatus}
                            onChange={e => changePlayerStatus(s.userId, e.target.value as any)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300"
                          >
                            <option value="active">Actif</option>
                            <option value="finished">Terminé</option>
                            <option value="suspended">Suspendu</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {stats.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                          {tournament.matchmakingDoneChampionship
                            ? 'Aucun joueur inscrit'
                            : 'Matchmaking non effectué — les stats apparaîtront après la génération'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Matchs ──────────────────────────────────────────────── */}
          {tab === 'matches' && (
            <div className="space-y-4">
              {/* Filtres */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un joueur..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <select
                  value={matchFilter}
                  onChange={e => setMatchFilter(e.target.value as MatchStatusFilter)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">Non joué</option>
                  <option value="awaiting_validation">En attente</option>
                  <option value="validated">Validé</option>
                  <option value="rejected">Rejeté</option>
                  <option value="disputed">Litige</option>
                </select>
                <span className="text-sm text-gray-500 self-center">{filteredMatches.length} match(s)</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Joueur 1</th>
                      <th className="px-4 py-3 text-center">VS</th>
                      <th className="px-4 py-3 text-left">Joueur 2</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Résultat</th>
                      <th className="px-4 py-3 text-center">Preuves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMatches.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={m.player1Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.player1Username)}`} className="w-7 h-7 rounded-full" alt="" />
                            <span className={`font-medium ${m.result === 'player1_win' ? 'text-green-700' : 'text-gray-800'}`}>{m.player1Username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400 font-bold">⚔️</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={m.player2Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.player2Username)}`} className="w-7 h-7 rounded-full" alt="" />
                            <span className={`font-medium ${m.result === 'player2_win' ? 'text-green-700' : 'text-gray-800'}`}>{m.player2Username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{statusBadge(m.status)}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {m.result === 'player1_win' ? `✅ ${m.player1Username}` : m.result === 'player2_win' ? `✅ ${m.player2Username}` : m.result === 'draw' ? '🤝 Nul' : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(m.player1ProofUrl || m.player2ProofUrl) ? (
                            <div className="flex justify-center gap-1">
                              {m.player1ProofUrl && <a href={m.player1ProofUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">J1</a>}
                              {m.player2ProofUrl && <a href={m.player2ProofUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">J2</a>}
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredMatches.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun match trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Validation ──────────────────────────────────────────── */}
          {tab === 'validation' && (
            <div className="space-y-4">
              {pendingValidations.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Aucun match en attente de validation</p>
                </div>
              ) : (
                pendingValidations.map(match => (
                  <div key={match.id} className="border border-amber-200 rounded-xl p-5 bg-amber-50 space-y-4">
                    {/* Joueurs */}
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <img
                          src={match.player1Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.player1Username)}&background=7c3aed&color=fff`}
                          className="w-12 h-12 rounded-full mx-auto mb-1 object-cover"
                          alt=""
                        />
                        <p className="font-bold text-gray-800 text-sm">{match.player1Username}</p>
                        {match.player1Result && (
                          <span className={`text-xs font-semibold ${match.player1Result === 'win' ? 'text-green-600' : match.player1Result === 'draw' ? 'text-blue-600' : 'text-red-500'}`}>
                            déclare : {match.player1Result === 'win' ? 'Victoire' : match.player1Result === 'draw' ? 'Nul' : 'Défaite'}
                          </span>
                        )}
                      </div>
                      <span className="text-2xl font-black text-gray-400">⚔️</span>
                      <div className="text-center">
                        <img
                          src={match.player2Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.player2Username)}&background=059669&color=fff`}
                          className="w-12 h-12 rounded-full mx-auto mb-1 object-cover"
                          alt=""
                        />
                        <p className="font-bold text-gray-800 text-sm">{match.player2Username}</p>
                        {match.player2Result && (
                          <span className={`text-xs font-semibold ${match.player2Result === 'win' ? 'text-green-600' : match.player2Result === 'draw' ? 'text-blue-600' : 'text-red-500'}`}>
                            déclare : {match.player2Result === 'win' ? 'Victoire' : match.player2Result === 'draw' ? 'Nul' : 'Défaite'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preuves */}
                    {(match.player1ProofUrl || match.player2ProofUrl) && (
                      <div className="flex gap-3 justify-center">
                        {match.player1ProofUrl && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Preuve {match.player1Username}</p>
                            <a href={match.player1ProofUrl} target="_blank" rel="noreferrer">
                              <img src={match.player1ProofUrl} alt="Preuve J1" className="h-28 rounded-lg border border-gray-200 object-cover hover:opacity-90 transition" />
                            </a>
                          </div>
                        )}
                        {match.player2ProofUrl && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Preuve {match.player2Username}</p>
                            <a href={match.player2ProofUrl} target="_blank" rel="noreferrer">
                              <img src={match.player2ProofUrl} alt="Preuve J2" className="h-28 rounded-lg border border-gray-200 object-cover hover:opacity-90 transition" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Boutons de validation */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        disabled={actionLoading === match.id}
                        onClick={() => validateMatch(match, 'player1_win')}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Victoire {match.player1Username}
                      </button>
                      <button
                        disabled={actionLoading === match.id}
                        onClick={() => validateMatch(match, 'player2_win')}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Victoire {match.player2Username}
                      </button>
                      <button
                        disabled={actionLoading === match.id}
                        onClick={() => validateMatch(match, 'draw')}
                        className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        🤝 Match nul
                      </button>
                      <button
                        disabled={actionLoading === match.id}
                        onClick={() => rejectMatch(match.id)}
                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeter
                      </button>
                    </div>
                    {actionLoading === match.id && (
                      <div className="flex justify-center mt-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-600" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TAB: Classement ──────────────────────────────────────────── */}
          {tab === 'leaderboard' && (
            <div className="space-y-8">
              {leaderboard.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-3" />
                  <p>Le classement sera disponible après le début des matchs</p>
                </div>
              ) : (
                <>
                  {/* Top 3 Championnat */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {leaderboard.slice(0, 3).map((entry, idx) => {
                      const colors = [
                        'bg-yellow-50 border-yellow-200 text-yellow-800',
                        'bg-gray-50 border-gray-200 text-gray-800',
                        'bg-orange-50 border-orange-200 text-orange-800'
                      ];
                      const trophyColors = ['text-yellow-500', 'text-gray-400', 'text-orange-500'];
                      
                      return (
                        <div
                          key={entry.userId}
                          className={`rounded-2xl shadow-sm p-6 border-2 flex flex-col items-center transition-transform hover:scale-[1.02] ${colors[idx]}`}
                        >
                          <div className="relative mb-4">
                            <img
                              src={entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.username)}&background=7c3aed&color=fff`}
                              alt={entry.username}
                              className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover"
                            />
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                              <Trophy className={`w-5 h-5 ${trophyColors[idx]}`} />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{entry.username}</h3>
                          <p className="text-3xl font-black text-violet-700 mb-2">{entry.points} pts</p>
                          <div className="flex items-center gap-3 text-xs font-medium text-gray-500 bg-white/50 px-3 py-1 rounded-full">
                            <span>{entry.wins}V</span>
                            <span>•</span>
                            <span>{entry.draws}N</span>
                            <span>•</span>
                            <span>{entry.losses}D</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Liste complète avec style moderne */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                          <th className="px-6 py-3 text-left">Rang</th>
                          <th className="px-6 py-3 text-left">Joueur</th>
                          <th className="px-6 py-3 text-center">Points</th>
                          <th className="px-6 py-3 text-center">Victoires</th>
                          <th className="px-6 py-3 text-center">Joués</th>
                          <th className="px-6 py-3 text-center">Série</th>
                          <th className="px-6 py-3 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {leaderboard.map((s, idx) => (
                          <tr key={s.userId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-gray-100 text-gray-700' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'text-gray-400'
                              }`}>
                                {idx + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={s.avatarUrl} className="w-9 h-9 rounded-full" alt="" />
                                <div>
                                  <p className="font-bold text-gray-900">{s.username}</p>
                                  <p className="text-[10px] text-gray-400 uppercase font-black">ID: {s.userId.slice(0, 8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-lg font-black text-violet-600">{s.points}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-bold text-green-600">{s.wins}</span>
                            </td>
                            <td className="px-6 py-4 text-center font-medium text-gray-600">
                              {s.matchesPlayed}
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center justify-center gap-1">
                                  <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="h-full bg-violet-500 transition-all duration-500" 
                                      style={{ width: `${Math.round(s.performanceRatio * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-400">{Math.round(s.performanceRatio * 100)}%</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {playerStatusBadge(s.playerStatus)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
