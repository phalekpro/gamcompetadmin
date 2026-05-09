import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Dispute } from '../types';
import toast from 'react-hot-toast';
import { Eye, CheckCircle } from 'lucide-react';

export default function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const q = query(
        collection(db, 'disputes'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const disputesData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Dispute));
      setDisputes(disputesData);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async (disputeId: string) => {
    if (!resolution.trim()) {
      toast.error('Veuillez entrer une résolution');
      return;
    }

    try {
      await updateDoc(doc(db, 'disputes', disputeId), {
        status: 'resolved',
        resolution,
        resolvedAt: serverTimestamp(),
      });
      setDisputes(disputes.map(d => 
        d.id === disputeId ? { ...d, status: 'resolved' as const, resolution } : d
      ));
      toast.success('Litige résolu');
      setSelectedDispute(null);
      setResolution('');
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast.error('Erreur lors de la résolution');
    }
  };

  const getStatusColor = (status: Dispute['status']) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Litiges</h1>
        <p className="text-gray-500 mt-1">{disputes.filter(d => d.status !== 'resolved').length} litiges en attente</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rapporté par</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">
                    {dispute.matchId.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{dispute.reportedBy}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{dispute.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dispute.status)}`}>
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedDispute(dispute)}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Details Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Détails du Litige</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match ID</label>
                <p className="text-sm text-gray-900 font-mono">{selectedDispute.matchId}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
                <p className="text-sm text-gray-900">{selectedDispute.reason}</p>
              </div>

              {selectedDispute.evidence.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preuves</label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDispute.evidence.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Preuve {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedDispute.status !== 'resolved' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Résolution</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Décrivez la résolution du litige..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={4}
                  />
                  <button
                    onClick={() => resolveDispute(selectedDispute.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Résoudre le litige
                  </button>
                </div>
              )}

              {selectedDispute.resolution && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">Résolution</p>
                  <p className="text-sm text-green-700">{selectedDispute.resolution}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedDispute(null);
                  setResolution('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
