import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardService, DashboardStats, DailyRegistrations, TournamentStats } from '../services/dashboardService';
import { 
  Users, Trophy, Swords, AlertTriangle, DollarSign, TrendingUp, 
  CreditCard, Clock
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTournaments: 0,
    activeTournaments: 0,
    totalMatches: 0,
    pendingMatches: 0,
    openDisputes: 0,
    pendingTransactions: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayRegistrations: 0,
    weeklyRegistrations: 0,
    monthlyRegistrations: 0,
    totalCompletedPayments: 0,
    totalPendingPayments: 0,
  });
  const [dailyRegistrations, setDailyRegistrations] = useState<DailyRegistrations[]>([]);
  const [tournamentStats, setTournamentStats] = useState<TournamentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsData, dailyData, tournamentData] = await Promise.all([
        dashboardService.getDashboardStats(),
        dashboardService.getDailyRegistrations(30),
        dashboardService.getTournamentStats()
      ]);

      setStats(statsData);
      setDailyRegistrations(dailyData);
      setTournamentStats(tournamentData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Utilisateurs Totaux',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      change: stats.todayRegistrations,
      changeLabel: "aujourd'hui"
    },
    {
      title: 'Tournois Actifs',
      value: stats.activeTournaments,
      icon: Trophy,
      color: 'bg-green-500',
      change: stats.totalTournaments - stats.activeTournaments,
      changeLabel: "terminés"
    },
    {
      title: 'Revenu du Jour',
      value: `${stats.todayRevenue.toLocaleString()} FCFA`,
      icon: DollarSign,
      color: 'bg-purple-500',
      change: stats.totalRevenue,
      changeLabel: "total"
    },
    {
      title: 'Matchs en Attente',
      value: stats.pendingMatches,
      icon: Swords,
      color: 'bg-orange-500',
      change: stats.totalMatches,
      changeLabel: "total"
    },
    {
      title: 'Inscriptions Semaine',
      value: stats.weeklyRegistrations,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      change: stats.monthlyRegistrations,
      changeLabel: "ce mois"
    },
    {
      title: 'Paiements Complétés',
      value: stats.totalCompletedPayments,
      icon: CreditCard,
      color: 'bg-teal-500',
      change: stats.totalPendingPayments,
      changeLabel: "en attente"
    },
    {
      title: 'Litiges Ouverts',
      value: stats.openDisputes,
      icon: AlertTriangle,
      color: 'bg-red-500',
      change: null,
      changeLabel: ""
    },
    {
      title: 'Paiements en Attente',
      value: stats.totalPendingPayments,
      icon: Clock,
      color: 'bg-yellow-500',
      change: null,
      changeLabel: ""
    }
  ];

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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de la plateforme</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                {stat.change !== null && (
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium">{stat.change}</span> {stat.changeLabel}
                  </p>
                )}
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center ml-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Registrations Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inscriptions par jour (30 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyRegistrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                }}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aperçu des revenus</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-green-600 font-medium">Revenu du jour</p>
                <p className="text-2xl font-bold text-green-700">{stats.todayRevenue.toLocaleString()} FCFA</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-blue-600 font-medium">Revenu total</p>
                <p className="text-2xl font-bold text-blue-700">{stats.totalRevenue.toLocaleString()} FCFA</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Paiements complétés</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalCompletedPayments}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-yellow-600">En attente</p>
                <p className="text-lg font-bold text-yellow-700">{stats.totalPendingPayments}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tournaments */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tournois récents</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Nom</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Jeu</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Participants</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Frais d'inscription</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Statut</th>
              </tr>
            </thead>
            <tbody>
              {tournamentStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    Aucun tournoi trouvé
                  </td>
                </tr>
              ) : (
                tournamentStats.map((tournament) => (
                  <tr key={tournament.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{tournament.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{tournament.game}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium">{tournament.registeredCount || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-green-600">
                        {tournament.entryFee ? `${tournament.entryFee.toLocaleString()} FCFA` : 'Gratuit'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tournament.status === 'open' ? 'bg-green-100 text-green-800' :
                        tournament.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        tournament.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tournament.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
