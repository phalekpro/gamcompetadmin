import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, Phone, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { manualVerificationService, ManualVerificationRequest } from '../services/manualVerificationService';

const ManualVerification: React.FC = () => {
  const [requests, setRequests] = useState<ManualVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await manualVerificationService.getPendingRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await manualVerificationService.approveRequest(requestId, 'admin');
      toast.success('✅ Demande approuvée avec succès');
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const notes = prompt('Veuillez indiquer la raison du rejet:');
    if (!notes) return;

    setProcessing(requestId);
    try {
      await manualVerificationService.rejectRequest(requestId, 'admin', notes);
      toast.success('❌ Demande rejetée');
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erreur lors du rejet');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vérifications Manuelles</h1>
          <p className="text-gray-500 mt-1">Gérez les demandes de vérification de paiement manuelle</p>
        </div>
        <button
          onClick={loadRequests}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Actualiser
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune demande en attente</h3>
            <p className="text-gray-500">Toutes les demandes ont été traitées</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tournoi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(request.requestedAt)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium text-gray-900">{request.username}</div>
                          <div className="text-xs text-gray-500">{request.userId.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-900">{request.phoneNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-orange-600">
                      {request.paymentAmount.toLocaleString()} FCFA
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center">
                        <Trophy className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-900">{request.tournamentId.substring(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processing === request.id}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing === request.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Approuver
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={processing === request.id}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing === request.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualVerification;
