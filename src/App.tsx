import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tournaments from './pages/Tournaments';
import TournamentBracket from './pages/TournamentBracket';
import TournamentParticipants from './pages/TournamentParticipants';
import TournamentMatchMaking from './pages/TournamentMatchMaking';
import Matches from './pages/Matches';
import MatchReports from './pages/MatchReports';
import Disputes from './pages/Disputes';
import Transactions from './pages/Transactions';
import Leaderboard from './pages/Leaderboard';
import UserDetails from './pages/UserDetails';
import Support from './pages/Support';
import Messaging from './pages/Messaging';
import Layout from './components/Layout';
import ChampionshipDetail from './pages/ChampionshipDetail';
import ChampionshipMatchmaking from './pages/ChampionshipMatchmaking';
import DebugUsers from './pages/DebugUsers';
import DebugVision from './pages/DebugVision';

// Page Debug unifiée avec onglets
function DebugPage() {
  const [tab, setTab] = React.useState<'users' | 'vision'>('users');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Debug</h1>
        <p className="text-gray-500 mt-1">Outils de test et de diagnostic</p>
      </div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('users')}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'users' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Joueurs de test
        </button>
        <button
          onClick={() => setTab('vision')}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'vision' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Tester Gemini OCR
        </button>
      </div>
      {tab === 'users' ? <DebugUsers /> : <DebugVision />}
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<UserDetails />} />
        <Route path="tournaments" element={<Tournaments />} />
        <Route path="tournaments/:tournamentId/bracket" element={<TournamentBracket />} />
        <Route path="tournaments/:tournamentId/participants" element={<TournamentParticipants />} />
        <Route path="tournaments/:tournamentId/matchmaking" element={<TournamentMatchMaking />} />
        <Route path="championships/:tournamentId" element={<ChampionshipDetail />} />
        <Route path="championships/:tournamentId/matchmaking" element={<ChampionshipMatchmaking />} />
        <Route path="matches" element={<Matches />} />
        <Route path="match-reports" element={<MatchReports />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="support" element={<Support />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="debug" element={<DebugPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
