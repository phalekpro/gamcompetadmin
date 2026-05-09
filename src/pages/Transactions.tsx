import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction } from '../types';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, DollarSign, Activity, Smartphone } from 'lucide-react';

interface WaveLog {
  id: string;
  notification_id: string;
  title: string;
  content: string;
  sender_phone: string;
  status: string;
  received_at: any;
  raw_parsed_data?: {
    amount?: number;
    transaction_type?: string;
  };
}

export default function Transactions() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'wave_logs' | 'pending_payments'>('transactions');

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  // Wave Logs State
  const [waveLogs, setWaveLogs] = useState<WaveLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Pending Wave Payments (participants dans les tournois)
  interface PendingPayment {
    id: string; // id du doc participant
    tournamentId: string;
    userId: string;
    username: string;
    email?: string; // Email de l'utilisateur
    phone?: string; // Téléphone principal de l'utilisateur
    paymentAmount: number;
    paymentStatus: string;
    paymentPhone?: string; // Téléphone utilisé pour le paiement
    registeredAt?: any;
    whatsappReminderSent?: boolean; // Si le rappel WhatsApp a été envoyé
    reminderSentBy?: string; // ID de l'admin qui a envoyé le rappel
    reminderSentAt?: any; // Date d'envoi du rappel
  }

  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchTransactions();
    fetchWaveLogs();
    fetchPendingPayments();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Erreur chargement transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchWaveLogs = async () => {
    try {
      setLoadingLogs(true);
      const q = query(collection(db, 'notifications_received'), orderBy('received_at', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WaveLog));
      setWaveLogs(logsData);
    } catch (error) {
      console.error('Error fetching wave logs:', error);
      // toast.error('Erreur chargement logs Wave'); // Silent fail acceptable if collection doesn't exist yet
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      setLoadingPending(true);
      // SOLUTION SIMPLE : Lire directement depuis la collection dédiée
      const q = query(
        collection(db, 'pending_payments'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const data: PendingPayment[] = [];
      
      // Pour chaque paiement en attente, récupérer les infos complètes de l'utilisateur
      for (const d of snapshot.docs) {
        const raw: any = d.data();
        
        console.log('📱 Pending payment raw data:', {
          id: d.id,
          userId: raw.userId,
          phone: raw.phone,
          paymentPhone: raw.paymentPhone,
          username: raw.username
        });
        
        // Téléphone de paiement: vient de pending_payments (champ paymentPhone)
        const paymentPhone = raw.paymentPhone || '';

        // Téléphone principal: vient idéalement de users.phone
        // Fallbacks: pending_payments.registrationData.phoneNumber, puis raw.phone
        let userPhone = raw?.registrationData?.phoneNumber || raw.phone || '';
        let userEmail = raw.email || '';

        // Toujours tenter de récupérer le téléphone principal depuis la collection users
        if (raw.userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', raw.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userPhone = userData.phone || userPhone || '';
              userEmail = userData.email || '';
              console.log('📱 User data from users collection:', {
                userId: raw.userId,
                phone: userData.phone,
                email: userData.email
              });
            } else {
              console.log('❌ User document not found for userId:', raw.userId);
            }
          } catch (error) {
            console.error('Error fetching user phone:', error);
          }
        }
        
        data.push({
          id: d.id,
          tournamentId: raw.tournamentId || 'inconnu',
          userId: raw.userId || '',
          username: raw.username || 'Inconnu',
          email: userEmail,
          phone: userPhone,
          paymentAmount: raw.paymentAmount || 0,
          paymentStatus: raw.paymentStatus || 'pending_payment',
          paymentPhone,
          registeredAt: raw.registeredAt,
          whatsappReminderSent: raw.whatsappReminderSent || false,
          reminderSentBy: raw.reminderSentBy || '',
          reminderSentAt: raw.reminderSentAt || null
        });
      }
      
      // Trier les données
      const sortedData = sortPendingPayments(data, sortBy, sortOrder);
      setPendingPayments(sortedData);
      
      if (data.length === 0) {
        console.log('Aucun paiement en attente trouvé dans pending_payments');
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast.error('Erreur lors du chargement des paiements en attente');
    } finally {
      setLoadingPending(false);
    }
  };

  const sortPendingPayments = (payments: PendingPayment[], sortBy: 'date' | 'name', sortOrder: 'asc' | 'desc') => {
    return [...payments].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        const dateA = a.registeredAt?.toMillis?.() || new Date(a.registeredAt).getTime() || 0;
        const dateB = b.registeredAt?.toMillis?.() || new Date(b.registeredAt).getTime() || 0;
        comparison = dateA - dateB;
      } else if (sortBy === 'name') {
        comparison = a.username.localeCompare(b.username);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (newSortBy: 'date' | 'name') => {
    if (newSortBy === sortBy) {
      // Inverser l'ordre si même critère
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      const sortedData = sortPendingPayments(pendingPayments, newSortBy, newOrder);
      setPendingPayments(sortedData);
    } else {
      // Nouveau critère de tri
      setSortBy(newSortBy);
      setSortOrder('asc'); // Repartir du tri ascendant
      const sortedData = sortPendingPayments(pendingPayments, newSortBy, 'asc');
      setPendingPayments(sortedData);
    }
  };

  const markWhatsAppReminderSent = async (payment: PendingPayment) => {
    try {
      await updateDoc(doc(db, 'pending_payments', payment.id), {
        whatsappReminderSent: true,
        reminderSentBy: 'admin', // ID de l'admin actuel
        reminderSentAt: serverTimestamp()
      });
      
      // Mettre à jour l'état local
      setPendingPayments(prev => prev.map(p => 
        p.id === payment.id 
          ? { ...p, whatsappReminderSent: true, reminderSentAt: new Date(), reminderSentBy: 'admin' }
          : p
      ));
      
      toast.success('Rappel WhatsApp marqué comme envoyé');
    } catch (error) {
      console.error('Error marking whatsapp reminder:', error);
      toast.error('Erreur lors du marquage du rappel WhatsApp');
    }
  };

  const updateTransactionStatus = async (transactionId: string, status: 'completed' | 'failed') => {
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        status,
        updatedAt: serverTimestamp(),
      });
      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status } : t
      ));
      toast.success(`Transaction ${status === 'completed' ? 'validée' : 'rejetée'}`);
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const validatePendingPayment = async (payment: PendingPayment) => {
    if (!payment.tournamentId || !payment.userId) return;

    if (!window.confirm(`Valider manuellement le paiement de ${payment.username} (${payment.paymentAmount} FCFA) ?`)) {
      return;
    }

    try {
      // 1) Mettre à jour le doc participant dans la sous-collection
      const participantRef = doc(db, 'tournaments', payment.tournamentId, 'participants', payment.userId);
      await updateDoc(participantRef, {
        paymentStatus: 'completed',
        paymentMethod: 'Manual Admin',
        transactionId: `manual_${Date.now()}`,
        paidAt: serverTimestamp()
      });

      // 2) Ajouter le joueur au tableau participants du tournoi
      const tournamentRef = doc(db, 'tournaments', payment.tournamentId);
      await updateDoc(tournamentRef, {
        participants: arrayUnion(payment.userId)
      });

      // 3) SUPPRIMER de la collection pending_payments
      const pendingRef = doc(db, 'pending_payments', payment.id);
      await deleteDoc(pendingRef);

      toast.success('Paiement validé et joueur inscrit au tournoi');

      // 4) Mettre à jour la liste locale
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
    } catch (error) {
      console.error('Error validating pending payment:', error);
      toast.error('Erreur lors de la validation manuelle');
    }
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit': return 'text-green-600';
      case 'withdrawal': return 'text-red-600';
      case 'entry_fee': return 'text-orange-600';
      case 'prize': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed':
      case 'processed': return 'bg-green-100 text-green-800';
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'error': return 'bg-red-100 text-red-800';
      case 'duplicate': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTransactions = transactions.filter(t =>
    filter === 'all' || t.status === filter
  );

  const totalRevenue = transactions
    .filter(t => t.type === 'entry_fee' && t.status === 'completed')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const pendingWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'pending')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions & Logs</h1>
          <p className="text-gray-500 mt-1">Gérez les transactions financières et surveillez les webhooks</p>
        </div>

        {/* Tabs */}
        <div className="bg-white p-1 rounded-lg border border-gray-200 flex">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'transactions'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <DollarSign className="w-4 h-4" />
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('wave_logs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'wave_logs'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Activity className="w-4 h-4" />
            Logs Wave Webhook
          </button>
          <button
            onClick={() => setActiveTab('pending_payments')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'pending_payments'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Smartphone className="w-4 h-4" />
            Inscriptions en attente
          </button>
        </div>
      </div>

      {activeTab === 'transactions' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Revenus Totaux</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalRevenue.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Retraits en Attente</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{pendingWithdrawals.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-yellow-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inscriptions en Attente</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{pendingPayments.length}</p>
                </div>
                <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Montant Total en Attente</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {pendingPayments.reduce((sum, p) => sum + p.paymentAmount, 0).toLocaleString()} FCFA
                  </p>
                </div>
                <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex gap-2">
              {(['all', 'pending', 'completed', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {status === 'all' ? 'Toutes' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loadingTransactions ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">
                          {transaction.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{transaction.userId.substring(0, 8)}...</td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${getTypeColor(transaction.type)}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()} FCFA
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {transaction.description}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {transaction.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateTransactionStatus(transaction.id, 'completed')}
                                className="text-green-600 hover:text-green-700 transition-colors"
                                title="Valider"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => updateTransactionStatus(transaction.id, 'failed')}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Rejeter"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'wave_logs' ? (
        <>
          {/* Wave Logs View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-700">Historique des notifications Wave (50 dernières)</h3>
                <p className="text-xs text-gray-500">Données brutes reçues via le webhook</p>
              </div>
              <button
                onClick={fetchWaveLogs}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Activity className="w-3 h-3" /> Actualiser
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date (Process)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Extrait</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expéditeur / Tiers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message Contenu</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut Traitement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Wave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {waveLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">
                          Aucune notification reçue pour le moment.
                        </td>
                      </tr>
                    ) : (
                      waveLogs.map((log) => {
                        const amount = log.raw_parsed_data?.amount || 0;
                        const type = log.raw_parsed_data?.transaction_type || 'received';
                        const date = log.received_at?.toDate ? log.received_at.toDate().toLocaleString('fr-FR') : 'N/A';

                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {date}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-bold font-mono ${type === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                                {amount} FCFA
                              </span>
                              {type === 'received' && <span className="text-xs text-green-600 ml-1">↓</span>}
                              {type === 'sent' && <span className="text-xs text-red-600 ml-1">↑</span>}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-50 p-1 rounded">
                                  <Smartphone className="w-3 h-3 text-blue-500" />
                                </div>
                                {log.sender_phone || 'Inconnu'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 max-w-xs">
                              <div className="bg-gray-50 p-2 rounded border border-gray-100 font-mono truncate" title={log.content}>
                                {log.content}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wide ${getStatusColor(log.status)}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-gray-400">
                              {log.notification_id}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800 flex gap-2">
            <Activity className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Note technique :</strong> Ces logs proviennent directement du Webhook Wave configuré.
              Si le statut est "Processed", cela signifie que le système a tenté de réconcilier ce paiement avec une inscription en attente.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Pending Payments View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-700">Inscriptions tournois en attente de paiement (Wave)</h3>
                <p className="text-xs text-gray-500">
                  Ces joueurs ont cliqué sur le lien Wave et sont enregistrés avec le statut &quot;pending_payment&quot;.
                  Vous pouvez valider manuellement si nécessaire.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Trier par:</span>
                  <button
                    onClick={() => handleSort('date')}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      sortBy === 'date' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSort('name')}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      sortBy === 'name' 
                        ? 'bg-primary text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Nom {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
                <button
                  onClick={fetchPendingPayments}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Activity className="w-3 h-3" /> Actualiser
                </button>
              </div>
            </div>

            {loadingPending ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Heure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tournoi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone Principal</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone Paiement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rappels Envoyés</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingPayments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500 italic">
                          Aucune inscription en attente de paiement pour le moment.
                        </td>
                      </tr>
                    ) : (
                      pendingPayments.map((p) => {
                        // Formater la date et l'heure
                        let dateStr = 'N/A';
                        if (p.registeredAt) {
                          try {
                            const date = p.registeredAt.toDate ? p.registeredAt.toDate() : new Date(p.registeredAt);
                            dateStr = date.toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          } catch (e) {
                            console.error('Erreur format date:', e);
                          }
                        }
                        
                        return (
                          <tr key={`${p.tournamentId}_${p.id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                              <div className="flex flex-col">
                                <span className="text-gray-900">{dateStr.split(' ')[0]}</span>
                                <span className="text-xs text-gray-500">{dateStr.split(' ')[1]}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={p.tournamentId}>
                                {p.tournamentId.substring(0, 12)}...
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="flex flex-col">
                                <span className="font-medium">{p.username}</span>
                                <span className="text-xs text-gray-400">{p.userId.substring(0, 8)}...</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-orange-600">
                              {p.paymentAmount.toLocaleString()} FCFA
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3 text-blue-500" />
                                {p.phone || 'Non renseigné'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              <div className="flex items-center gap-1">
                                <div className="bg-green-50 p-1 rounded">
                                  <Smartphone className="w-3 h-3 text-green-500" />
                                </div>
                                {p.paymentPhone || 'Non renseigné'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  p.whatsappReminderSent 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  WhatsApp: {p.whatsappReminderSent ? 'Oui' : 'Non'}
                                </span>
                                {p.reminderSentAt && (
                                  <span className="text-xs text-gray-500">
                                    {p.reminderSentAt.toDate ? p.reminderSentAt.toDate().toLocaleString('fr-FR') : new Date(p.reminderSentAt).toLocaleString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                En attente
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => markWhatsAppReminderSent(p)}
                                  disabled={p.whatsappReminderSent}
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                    p.whatsappReminderSent
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                  title="Marquer le rappel WhatsApp comme envoyé"
                                >
                                  💬 WhatsApp
                                </button>
                                <button
                                  onClick={() => validatePendingPayment(p)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Valider
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-sm text-yellow-900 flex gap-2">
            <Smartphone className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Important :</strong> utilisez cette validation manuelle seulement si vous avez vérifié sur votre
              téléphone Wave que le paiement a bien été reçu. Le webhook continuera de fonctionner normalement en
              parallèle.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
