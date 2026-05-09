import { collection, query, where, getCountFromServer, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface DailyRegistrations {
  date: string;
  count: number;
  timestamp: Timestamp;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTournaments: number;
  activeTournaments: number;
  totalMatches: number;
  pendingMatches: number;
  openDisputes: number;
  pendingTransactions: number;
  totalRevenue: number;
  todayRevenue: number;
  todayRegistrations: number;
  weeklyRegistrations: number;
  monthlyRegistrations: number;
  totalCompletedPayments: number;
  totalPendingPayments: number;
}

export interface TournamentStats {
  id: string;
  name: string;
  participants: number;
  status: string;
  game: string;
  entryFee: number;
  registeredCount: number;
}

export const dashboardService = {
  // Récupérer les statistiques principales
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        usersSnap,
        activeTournamentsSnap,
        tournamentsSnap,
        pendingMatchesSnap,
        matchesSnap,
        openDisputesSnap,
        pendingPaymentsSnap,
        completedPaymentsSnap,
        todayRegistrationsSnap,
        weeklyRegistrationsSnap,
        monthlyRegistrationsSnap
      ] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(query(collection(db, 'tournaments'), where('status', 'in', ['open', 'in_progress']))),
        getCountFromServer(collection(db, 'tournaments')),
        getCountFromServer(query(collection(db, 'matches'), where('status', '==', 'pending'))),
        getCountFromServer(collection(db, 'matches')),
        getCountFromServer(query(collection(db, 'disputes'), where('status', 'in', ['open', 'under_review']))),
        getCountFromServer(query(collection(db, 'pending_payments'))),
        this.getCompletedPaymentsCount(),
        this.getRegistrationsSince(new Date(new Date().setHours(0, 0, 0, 0))),
        this.getRegistrationsSince(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        this.getRegistrationsSince(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ]);

      const todayRevenue = await this.getTodayRevenue();
      const totalRevenue = await this.getTotalRevenue();

      return {
        totalUsers: usersSnap.data().count,
        activeUsers: usersSnap.data().count,
        totalTournaments: tournamentsSnap.data().count,
        activeTournaments: activeTournamentsSnap.data().count,
        totalMatches: matchesSnap.data().count,
        pendingMatches: pendingMatchesSnap.data().count,
        openDisputes: openDisputesSnap.data().count,
        pendingTransactions: pendingPaymentsSnap.data().count,
        totalRevenue,
        todayRevenue,
        todayRegistrations: todayRegistrationsSnap,
        weeklyRegistrations: weeklyRegistrationsSnap,
        monthlyRegistrations: monthlyRegistrationsSnap,
        totalCompletedPayments: completedPaymentsSnap,
        totalPendingPayments: pendingPaymentsSnap.data().count
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Récupérer les inscriptions par jour pour les 30 derniers jours
  async getDailyRegistrations(days: number = 30): Promise<DailyRegistrations[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'users'),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const dailyData: { [key: string]: number } = {};

      // Initialiser tous les jours à 0
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = 0;
      }

      // Compter les inscriptions par jour
      snapshot.docs.forEach(doc => {
        const createdAt = doc.data().createdAt;
        if (createdAt && createdAt.toDate) {
          const date = createdAt.toDate();
          const dateStr = date.toISOString().split('T')[0];
          if (dailyData.hasOwnProperty(dateStr)) {
            dailyData[dateStr]++;
          }
        }
      });

      // Convertir en tableau et trier
      return Object.entries(dailyData)
        .map(([date, count]) => ({
          date,
          count,
          timestamp: Timestamp.fromDate(new Date(date))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error fetching daily registrations:', error);
      return [];
    }
  },

  // Récupérer les statistiques des tournois
  async getTournamentStats(): Promise<TournamentStats[]> {
    try {
      const q = query(
        collection(db, 'tournaments'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TournamentStats));
    } catch (error) {
      console.error('Error fetching tournament stats:', error);
      return [];
    }
  },

  // Récupérer le nombre d'inscriptions depuis une date
  async getRegistrationsSince(date: Date): Promise<number> {
    try {
      const q = query(
        collection(db, 'users'),
        where('createdAt', '>=', date)
      );
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch (error) {
      console.error('Error fetching registrations since date:', error);
      return 0;
    }
  },

  // Récupérer le revenu du jour
  async getTodayRevenue(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'payments_received'),
        where('received_at', '>=', today)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.reduce((total, doc) => {
        const amount = doc.data().amount || 0;
        return total + amount;
      }, 0);
    } catch (error) {
      console.error('Error fetching today revenue:', error);
      return 0;
    }
  },

  // Récupérer le revenu total
  async getTotalRevenue(): Promise<number> {
    try {
      const snapshot = await getDocs(collection(db, 'payments_received'));
      return snapshot.docs.reduce((total, doc) => {
        const amount = doc.data().amount || 0;
        return total + amount;
      }, 0);
    } catch (error) {
      console.error('Error fetching total revenue:', error);
      return 0;
    }
  },

  // Récupérer le nombre de paiements complétés
  async getCompletedPaymentsCount(): Promise<number> {
    try {
      const q = query(
        collection(db, 'payments_received'),
        where('processed', '==', true)
      );
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch (error) {
      console.error('Error fetching completed payments count:', error);
      return 0;
    }
  }
};
