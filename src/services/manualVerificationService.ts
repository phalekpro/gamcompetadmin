import { collection, addDoc, query, where, getDocs, getDoc, orderBy, limit, doc, updateDoc, serverTimestamp, writeBatch, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ManualVerificationRequest {
  id: string;
  userId: string;
  username: string;
  tournamentId: string;
  paymentAmount: number;
  phoneNumber: string;
  requestedAt: any;
  status: 'pending' | 'approved' | 'rejected';
  processedBy?: string;
  processedAt?: any;
  notes?: string;
}

export const manualVerificationService = {
  // Créer une demande de vérification manuelle
  async createManualVerificationRequest(data: {
    userId: string;
    username: string;
    tournamentId: string;
    paymentAmount: number;
    phoneNumber: string;
  }) {
    try {
      const docRef = await addDoc(collection(db, 'manual_verification_requests'), {
        ...data,
        requestedAt: serverTimestamp(),
        status: 'pending'
      });
      
      console.log('✅ Demande de vérification manuelle créée:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erreur création demande vérification:', error);
      throw error;
    }
  },

  // Récupérer les demandes en attente
  async getPendingRequests(): Promise<ManualVerificationRequest[]> {
    try {
      const q = query(
        collection(db, 'manual_verification_requests'),
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ManualVerificationRequest));
    } catch (error) {
      console.error('Erreur récupération demandes:', error);
      throw error;
    }
  },

  // Approuver une demande
  async approveRequest(requestId: string, adminId: string, notes?: string) {
    try {
      const requestRef = doc(db, 'manual_verification_requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Demande non trouvée');
      }

      const requestData = requestDoc.data();
      
      // Mettre à jour la demande
      await updateDoc(requestRef, {
        status: 'approved',
        processedBy: adminId,
        processedAt: serverTimestamp(),
        notes: notes || ''
      });

      // Valider le paiement
      await this.validatePaymentFromRequest(requestData as ManualVerificationRequest, adminId);
      
      console.log('✅ Demande approuvée:', requestId);
    } catch (error) {
      console.error('Erreur approbation demande:', error);
      throw error;
    }
  },

  // Rejeter une demande
  async rejectRequest(requestId: string, adminId: string, notes: string) {
    try {
      const requestRef = doc(db, 'manual_verification_requests', requestId);
      
      await updateDoc(requestRef, {
        status: 'rejected',
        processedBy: adminId,
        processedAt: serverTimestamp(),
        notes: notes
      });
      
      console.log('❌ Demande rejetée:', requestId);
    } catch (error) {
      console.error('Erreur rejet demande:', error);
      throw error;
    }
  },

  // Valider le paiement à partir d'une demande
  async validatePaymentFromRequest(request: ManualVerificationRequest, adminId: string) {
    try {
      const batch = writeBatch(db);

      // Récupérer l'inscription en attente
      const pendingQuery = query(
        collection(db, 'pending_payments'),
        where('userId', '==', request.userId),
        where('tournamentId', '==', request.tournamentId)
      );
      const pendingDocs = await getDocs(pendingQuery);
      
      if (!pendingDocs.empty) {
        const pendingDoc = pendingDocs.docs[0];
        const pendingData = pendingDoc.data();

        // Mettre à jour le statut du participant
        const participantRef = doc(db, 'tournaments', request.tournamentId, 'participants', request.userId);
        batch.update(participantRef, {
          paymentStatus: 'completed',
          paymentMethod: 'Manual Admin',
          transactionId: `manual_${Date.now()}`,
          paidAt: serverTimestamp()
        });

        // Ajouter le joueur au tableau des participants
        const tournamentRef = doc(db, 'tournaments', request.tournamentId);
        batch.update(tournamentRef, {
          participants: arrayUnion(request.userId)
        });

        // Supprimer de pending_payments
        batch.delete(pendingDoc.ref);

        await batch.commit();

        // Envoyer une notification à l'utilisateur
        await this.sendVerificationNotification(request.userId, request.username, request.tournamentId, 'approved');
      }
    } catch (error) {
      console.error('Erreur validation paiement:', error);
      throw error;
    }
  },

  // Envoyer une notification à l'utilisateur
  async sendVerificationNotification(userId: string, username: string, tournamentId: string, status: 'approved' | 'rejected') {
    try {
      const title = status === 'approved' 
        ? 'Paiement validé! 🎉' 
        : 'Paiement rejeté ❌';
      
      const content = status === 'approved'
        ? `Félicitations ${username}! Votre paiement a été validé manuellement et vous êtes maintenant inscrit au tournoi.`
        : `Bonjour ${username}, votre demande de vérification de paiement a été rejetée. Veuillez contacter le support pour plus d'informations.`;

      await addDoc(collection(db, 'user_notifications'), {
        userId,
        title,
        content,
        type: 'payment',
        priority: 'high',
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur envoi notification:', error);
    }
  }
};
