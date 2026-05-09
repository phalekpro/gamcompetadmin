import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaderboardEntry } from '../types';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'game' | 'competition'>('all');

  useEffect(() => {
    fetchLeaderboard();
  }, [filter]);

  const fetchLeaderboard = async () => {
    try {
      let q = query(
        collection(db, 'leaderboard'),
        orderBy('points', 'desc'),
        limit(100)
      );

      if (filter === 'game') {
        q = query(
          collection(db, 'leaderboard'),
          where('gameType', '!=', null),
          orderBy('gameType'),
          orderBy('points', 'desc'),
          limit(100)
        );
      } else if (filter === 'competition') {
        q = query(
          collection(db, 'leaderboard'),
          where('competitionId', '!=', null),
          orderBy('competitionId'),
          orderBy('points', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);
      const leaderboardData = snapshot.docs.map((doc, index) => ({
        userId: doc.id,
        ...doc.data(),
        rank: index + 1
      } as LeaderboardEntry));
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-white text-gray-800 border-gray-200';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Classement</h1>
          <p className="text-gray-500 mt-1">{leaderboard.length} joueurs classés</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilter('competition')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'competition' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Compétition
          </button>
          <button
            onClick={() => setFilter('game')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'game' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Jeu
          </button>
          <button
            onClick={fetchLeaderboard}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors ml-2"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {leaderboard.slice(0, 3).map((entry) => (
          <div
            key={entry.userId}
            className={`rounded-xl shadow-lg p-6 border-2 ${getRankColor(entry.rank)}`}
          >
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <img
                  src={entry.avatarUrl}
                  alt={entry.username}
                  className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
                />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Trophy className={`w-5 h-5 ${entry.rank === 1 ? 'text-yellow-500' :
                    entry.rank === 2 ? 'text-gray-400' :
                      'text-orange-500'
                    }`} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{entry.username}</h3>
              <p className="text-3xl font-extrabold text-primary mb-2">{entry.points}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{entry.wins || 0}V</span>
                <span>•</span>
                <span>{entry.losses || 0}D</span>
                <span>•</span>
                <span>{entry.winRate || 0}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Leaderboard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rang</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Victoires</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Défaites</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gains</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaderboard.map((entry) => (
                <tr key={entry.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${entry.rank <= 3 ? getRankColor(entry.rank) : 'bg-gray-100 text-gray-600'
                      }`}>
                      {entry.rank}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.avatarUrl}
                        alt={entry.username}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{entry.username}</p>
                        {entry.gameType && (
                          <p className="text-xs text-gray-500">{entry.gameType}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-primary">{entry.points}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">{entry.wins || 0}</td>
                  <td className="px-6 py-4 text-sm font-medium text-red-600">{entry.losses || 0}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{entry.winRate || 0}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {(entry.totalEarnings || 0).toLocaleString()} FCFA
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getTrendIcon(entry.trend)}
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
