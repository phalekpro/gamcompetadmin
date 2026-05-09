import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import toast from 'react-hot-toast';
import { Eye, CheckCircle, XCircle, Clock, AlertTriangle, Zap } from 'lucide-react';

interface MatchReport {
  id: string;
  matchId: string;
  tournamentId: string;
  userId: string;
  username: string;
  opponentId: string;
  opponentName: string;
  gameId?: string;
  outcome: 'win' | 'loss';
  proofUrl: string;
  comment: string;
  status: 'pending_verification' | 'verified' | 'disputed';
  createdAt: any;
  verifiedAt: any;
  verificationResult: 'win' | 'loss' | 'draw' | null;
  aiAnalysis: {
    confidence: number;
    detectedScore: string;
    score?: string;
    detectedWinner: string;
    rawData: any;
  } | null;
}

export default function MatchReports() {
  const [reports, setReports] = useState<MatchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MatchReport | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // 1. Fetch standard reports
      const qStandard = query(collection(db, 'match_reports'), orderBy('createdAt', 'desc'));
      const snapStandard = await getDocs(qStandard);
      const standardReports = snapStandard.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as MatchReport));

      // 2. Fetch championship matches awaiting validation
      const qChamp = query(collection(db, 'championship_matches'), orderBy('updatedAt', 'desc'));
      const snapChamp = await getDocs(qChamp);
      
      const championshipReports: MatchReport[] = [];
      
      snapChamp.docs.forEach(docSnap => {
        const data = docSnap.data();
        const matchId = docSnap.id;
        
        // Add player 1 report if exists and match needs validation
        if (data.player1ProofUrl && (data.status === 'awaiting_validation' || data.status === 'disputed')) {
          championshipReports.push({
            id: `${matchId}_p1`,
            matchId: matchId,
            tournamentId: data.tournamentId,
            userId: data.player1Id,
            username: data.player1Username,
            opponentId: data.player2Id,
            opponentName: data.player2Username,
            outcome: data.player1Result || 'win',
            proofUrl: data.player1ProofUrl,
            comment: "Soumission Championnat",
            status: data.status === 'disputed' ? 'disputed' : 'pending_verification',
            createdAt: data.player1SubmittedAt || data.createdAt,
            verifiedAt: data.adminValidatedAt,
            verificationResult: data.player1Result,
            aiAnalysis: null,
            isChampionship: true,
            playerIndex: 1
          } as any);
        }
        
        // Add player 2 report if exists
        if (data.player2ProofUrl && (data.status === 'awaiting_validation' || data.status === 'disputed')) {
          championshipReports.push({
            id: `${matchId}_p2`,
            matchId: matchId,
            tournamentId: data.tournamentId,
            userId: data.player2Id,
            username: data.player2Username,
            opponentId: data.player1Id,
            opponentName: data.player1Username,
            outcome: data.player2Result || 'win',
            proofUrl: data.player2ProofUrl,
            comment: "Soumission Championnat",
            status: data.status === 'disputed' ? 'disputed' : 'pending_verification',
            createdAt: data.player2SubmittedAt || data.createdAt,
            verifiedAt: data.adminValidatedAt,
            verificationResult: data.player2Result,
            aiAnalysis: null,
            isChampionship: true,
            playerIndex: 2
          } as any);
        }
      });

      const allReports = [...standardReports, ...championshipReports].sort((a, b) => {
        const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return t2 - t1;
      });

      setReports(allReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async (report: MatchReport & { isChampionship?: boolean }) => {
    const toastId = toast.loading('🔍 Analyse OCR en cours...');
    try {
      // Appel direct à la Cloud Function Firebase — aucun backend local requis
      const analyzeMatchOcr = httpsCallable(functions, 'analyzeMatchOcr');

      const response = await analyzeMatchOcr({
        imageUrl: report.proofUrl,
        matchId: report.matchId,
        tournamentId: report.tournamentId,
        type: (report as any).isChampionship ? 'championship' : 'standard',
        gameId: report.gameId,
        username: report.username,
        opponentName: report.opponentName,
      });

      const analysis = response.data as {
        success: boolean;
        outcome: 'win' | 'loss' | 'draw' | 'unknown';
        detectedScore: string;
        confidence: number;
        fullText: string;
      };

      toast.dismiss(toastId);
      toast.success('✅ Analyse OCR terminée !');

      const updatedReport = {
        ...report,
        aiAnalysis: {
          confidence: analysis.confidence,
          detectedScore: analysis.detectedScore,
          detectedWinner: analysis.outcome,
          rawData: analysis.fullText,
        },
      };

      setReports(reports.map(r => r.id === report.id ? (updatedReport as any) : r));
      setSelectedReport(updatedReport as any);

    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Error analyzing with AI:', error);

      // Erreur spécifique si la Cloud Function n'est pas encore déployée
      if (error?.code === 'functions/not-found' || error?.code === 'functions/internal') {
        toast.error(
          '⚠️ Cloud Function non déployée. Lance : cd backend/functions && npm run deploy',
          { duration: 7000 }
        );
      } else {
        toast.error(error?.message || 'Erreur lors de l\'analyse OCR', { duration: 5000 });
      }
    }
  };

  const verifyReport = async (report: MatchReport & { isChampionship?: boolean, playerIndex?: number }, victory: boolean) => {
    try {
      if (report.isChampionship && report.matchId) {
        // ── Validation championnat directement via Firestore (sans backend) ──
        const player1Wins =
          (report.playerIndex === 1 && victory) ||
          (report.playerIndex === 2 && !victory);

        const winnerId   = player1Wins ? report.userId     : report.opponentId;
        const loserId    = player1Wins ? report.opponentId : report.userId;
        const winnerName = player1Wins ? report.username   : report.opponentName;

        // 1) Mettre à jour le match
        await updateDoc(doc(db, 'championship_matches', report.matchId), {
          status:           'completed',
          winnerId,
          winnerName,
          adminValidatedAt: serverTimestamp(),
          updatedAt:        serverTimestamp(),
          ...(player1Wins
            ? { player1Result: 'win',  player2Result: 'loss' }
            : { player1Result: 'loss', player2Result: 'win'  }),
        });

        // 2) Mettre à jour les classements (+3 pts victoire)
        const { getDoc, setDoc } = await import('firebase/firestore');
        const winRef  = doc(db, 'championship_standings', `${report.tournamentId}_${winnerId}`);
        const loseRef = doc(db, 'championship_standings', `${report.tournamentId}_${loserId}`);
        const [winSnap, loseSnap] = await Promise.all([getDoc(winRef), getDoc(loseRef)]);
        const winData  = winSnap.exists()  ? winSnap.data()  : { points: 0, wins: 0, losses: 0 };
        const loseData = loseSnap.exists() ? loseSnap.data() : { points: 0, wins: 0, losses: 0 };

        await Promise.all([
          setDoc(winRef,  { ...winData,  tournamentId: report.tournamentId, userId: winnerId, points: (winData.points || 0) + 3, wins: (winData.wins || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }),
          setDoc(loseRef, { ...loseData, tournamentId: report.tournamentId, userId: loserId,  losses: (loseData.losses || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }),
        ]);

        toast.success(`✅ Victoire confirmée pour ${winnerName} (+3 pts)`);

      } else {
        // ── Validation standard ──
        await updateDoc(doc(db, 'match_reports', report.id), {
          status: 'verified',
          verificationResult: victory ? 'win' : 'loss',
          verifiedAt: serverTimestamp(),
        });
        toast.success('Rapport vérifié avec succès');
      }

      setReports(reports.map(r =>
        r.id === report.id
          ? { ...r, status: 'verified', verificationResult: victory ? 'win' : 'loss' }
          : r
      ));
      setShowModal(false);
      fetchReports();

    } catch (error: any) {
      console.error('Error verifying report:', error);
      toast.error(error.message || 'Erreur lors de la vérification');
    }
  };

  const disputeReport = async (report: MatchReport & { isChampionship?: boolean }) => {
    try {
      if (report.isChampionship && report.matchId) {
        // Pour les championnats on passe juste le match en 'disputed'
        await updateDoc(doc(db, 'championship_matches', report.matchId), {
          status: 'disputed',
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'match_reports', report.id), {
          status: 'disputed',
          verifiedAt: serverTimestamp(),
        });
      }
      
      setReports(reports.map(r => 
        r.id === report.id 
          ? { ...r, status: 'disputed' } 
          : r
      ));
      
      toast.success('Rapport marqué comme litigieux');
      setShowModal(false);
    } catch (error) {
      console.error('Error disputing report:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
            <Clock className="w-3 h-3" />
            En attente
          </span>
        );
      case 'verified':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
            <CheckCircle className="w-3 h-3" />
            Vérifié
          </span>
        );
      case 'disputed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Litige
          </span>
        );
      default:
        return null;
    }
  };

  const pendingReports = reports.filter(r => r.status === 'pending_verification');
  const verifiedReports = reports.filter(r => r.status === 'verified');
  const disputedReports = reports.filter(r => r.status === 'disputed');

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
        <h1 className="text-3xl font-bold text-gray-900">Rapports de Match</h1>
        <p className="text-gray-500 mt-1">{reports.length} rapports au total</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">En attente</p>
              <p className="text-2xl font-bold text-yellow-900">{pendingReports.length}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Vérifiés</p>
              <p className="text-2xl font-bold text-green-900">{verifiedReports.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Litiges</p>
              <p className="text-2xl font-bold text-red-900">{disputedReports.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Pending Reports */}
      {pendingReports.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">⏳ En attente de vérification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingReports.map((report) => (
              <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{report.username}</p>
                    <p className="text-sm text-gray-500">vs {report.opponentName}</p>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Déclaré: <span className={`font-bold ${report.outcome === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                      {report.outcome === 'win' ? 'Victoire' : 'Défaite'}
                    </span>
                  </p>
                  {report.comment && (
                    <p className="text-xs text-gray-500 mt-1 italic">"{report.comment}"</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedReport(report);
                    setShowModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Voir la preuve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Reports */}
      {verifiedReports.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">✅ Vérifiés</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verifiedReports.map((report) => (
              <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{report.username}</p>
                    <p className="text-sm text-gray-500">vs {report.opponentName}</p>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Résultat: <span className={`font-bold ${report.verificationResult === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                      {report.verificationResult === 'win' ? 'Victoire' : 'Défaite'}
                    </span>
                  </p>
                  {report.aiAnalysis && (
                    <p className="text-xs text-gray-500 mt-1">
                      Score: {report.aiAnalysis.detectedScore} • Confiance: {(report.aiAnalysis.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedReport(report);
                    setShowModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Voir les détails
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disputed Reports */}
      {disputedReports.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚠️ Litiges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {disputedReports.map((report) => (
              <div key={report.id} className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{report.username}</p>
                    <p className="text-sm text-gray-500">vs {report.opponentName}</p>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-red-600 font-medium">
                    Nécessite une intervention manuelle
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedReport(report);
                    setShowModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Arbitrer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Détails du rapport</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Match Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Joueur</p>
                  <p className="font-semibold">{selectedReport.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adversaire</p>
                  <p className="font-semibold">{selectedReport.opponentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Résultat déclaré</p>
                  <p className={`font-bold ${selectedReport.outcome === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedReport.outcome === 'win' ? 'Victoire' : 'Défaite'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>
              {selectedReport.comment && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Commentaire</p>
                  <p className="text-sm italic">"{selectedReport.comment}"</p>
                </div>
              )}
            </div>

            {/* Proof Image */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preuve fournie</p>
              <img 
                src={selectedReport.proofUrl} 
                alt="Preuve" 
                className="w-full rounded-lg border-2 border-gray-200"
              />
            </div>

            {/* AI Analysis (if available) */}
            {selectedReport.aiAnalysis ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-blue-900">🤖 Analyse IA (Vision OCR)</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedReport.aiAnalysis.detectedWinner === 'win' ? 'bg-green-100 text-green-700' :
                    selectedReport.aiAnalysis.detectedWinner === 'loss' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    Résultat détecté : {selectedReport.aiAnalysis.detectedWinner}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white p-2 rounded border border-blue-50">
                    <p className="text-[10px] text-gray-400 uppercase font-black">Score Détecté</p>
                    <p className="font-bold text-blue-800">{selectedReport.aiAnalysis.score || selectedReport.aiAnalysis.detectedScore || 'N/A'}</p>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-50">
                    <p className="text-[10px] text-gray-400 uppercase font-black">Confiance</p>
                    <p className="font-bold text-blue-800">{(selectedReport.aiAnalysis.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-blue-400 truncate italic">
                  Extrait : {selectedReport.aiAnalysis.rawData?.slice(0, 50)}...
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  onClick={() => analyzeWithAI(selectedReport)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-3 rounded-xl font-bold transition-all"
                >
                  <Zap className="w-5 h-5 text-indigo-500" />
                  Analyser avec Gemini OCR
                </button>
              </div>
            )}

            {/* Actions */}
            {selectedReport.status === 'pending_verification' && (
              <div className="flex gap-3">
                <button
                  onClick={() => verifyReport(selectedReport, true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirmer Victoire
                </button>
                <button
                  onClick={() => verifyReport(selectedReport, false)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  Confirmer Défaite
                </button>
                <button
                  onClick={() => disputeReport(selectedReport)}
                  className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <AlertTriangle className="w-5 h-5" />
                  Litige
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
