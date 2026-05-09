export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  gameId?: string;
  gameType?: string;
  level: number;
  isPro: boolean;
  isVerified: boolean;
  avatarUrl: string;
  role: 'user' | 'admin';
  stats: {
    tournaments: number;
    matches: number;
    wins: number;
    winRate: number;
    totalEarnings: number;
  };
  wallet: {
    balance: number;
    currency: string;
  };
  supercellProofUrl?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  createdAt: any;
  updatedAt?: any;
  customUserId?: string;
  isDebug?: boolean;
  debugCode?: string;
}

export interface Tournament {
  id: string;
  name: string;
  game: string;
  gameId?: string; // identifiant normalisé du jeu (ex: 'clash_royale')
  mode?: string;
  entryFee: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  maxParticipants: number;
  currentParticipants: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  isPaid: boolean;
  paymentLink?: string;
  registrationDeadline: any;
  startDate: any;
  endDate?: any;
  roomId?: string;
  participants: string[];
  participantsData?: {
    [userId: string]: {
      userId: string;
      username: string;
      avatarUrl: string;
      registeredAt: any;
      registrationData: {
        supercellId?: string;
        kingLevel?: number;
        arenaName?: string;
        [key: string]: any;
      };
      paymentStatus: string;
      paymentAmount: number;
      paymentMethod?: string;
      paymentPhone?: string;
      transactionId?: string;
    };
  };
  bracket?: any;
  imageUrl?: string;
  description?: string;
  rules?: string;
  createdAt: any;
  updatedAt?: any;

  // ─── Champs spécifiques aux Championnats 30 jours ───────────────────────
  type?: 'classic' | 'championship'; // 'classic' = bracket éliminatoire (défaut)
  duration?: number;                 // Durée en jours (30)
  registrationCloseDate?: any;       // Clôture inscriptions (jour 20)
  maxMatchesPerPlayer?: number;      // Max matchs par joueur (30)
  maxMatchesVsOpponent?: number;     // Max matchs vs même joueur (10)
  pointsSystem?: {
    win: number;   // 3
    draw: number;  // 1
    loss: number;  // 0
  };
  prizeDistribution?: {
    positions: Array<{ rank: number; percentage: number; label: string }>;
  };
  matchmakingDoneChampionship?: boolean; // true quand les adversaires ont été générés
}

// ───────────────────────────────────────────────────────────────────────────
// Types Championnat
// ───────────────────────────────────────────────────────────────────────────

export interface ChampionshipMatch {
  id: string;
  tournamentId: string;
  player1Id: string;
  player2Id: string;
  player1Username: string;
  player2Username: string;
  player1Avatar: string;
  player2Avatar: string;
  status: 'pending' | 'awaiting_validation' | 'validated' | 'rejected' | 'disputed';
  result?: 'player1_win' | 'player2_win' | 'draw';
  player1Result?: 'win' | 'loss' | 'draw' | null;
  player2Result?: 'win' | 'loss' | 'draw' | null;
  player1ProofUrl?: string;
  player2ProofUrl?: string;
  player1SubmittedAt?: any;
  player2SubmittedAt?: any;
  player1ValidatedAt?: any;
  player2ValidatedAt?: any;
  adminValidatedAt?: any;
  adminValidatedBy?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ChampionshipStats {
  id: string;              // `${tournamentId}_${userId}`
  tournamentId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
  matchesRemaining: number;
  matchesAssigned: number;
  performanceRatio: number; // points / (matchesPlayed * 3), 0 si aucun match
  assignedOpponents: string[];
  opponentMatchCount: Record<string, number>; // { [opponentId]: compteur }
  playerStatus: 'active' | 'finished' | 'suspended';
  registeredAt: any;
  updatedAt: any;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: string;
  player1Id: string;
  player2Id: string;
  player1Username: string;
  player2Username: string;
  player1Avatar: string;
  player2Avatar: string;
  winnerId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'disputed';
  scheduledTime: any;
  player1ProofUrl?: string;
  player2ProofUrl?: string;
  player1Result?: 'win' | 'loss' | 'pending';
  player2Result?: 'win' | 'loss' | 'pending';
  ocrValidation?: {
    player1: {
      confidence: number;
      detectedResult: string;
      isValid: boolean;
    };
    player2: {
      confidence: number;
      detectedResult: string;
      isValid: boolean;
    };
  };
  adminReview?: {
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: any;
    decision?: string;
  };
  createdAt: any;
  updatedAt?: any;
  isChampionship?: boolean;
  playerIndex?: number;
}

export interface Dispute {
  id: string;
  matchId: string;
  tournamentId: string;
  reportedBy: string;
  reason: string;
  evidence: string[];
  status: 'open' | 'under_review' | 'resolved';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: any;
  createdAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'entry_fee' | 'prize';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  tournamentId?: string;
  matchId?: string;
  description: string;
  createdAt: any;
  updatedAt?: any;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string;
  points: number;
  wins: number;
  losses: number;
  winRate: number;
  gameType?: string;
  season: string;
  trend: 'up' | 'down' | 'neutral';
  lastMatchDate?: any;
  totalEarnings: number;
  tournamentsPlayed: number;
  createdAt: any;
  updatedAt?: any;
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
}
