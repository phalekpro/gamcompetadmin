import { 
  collection, 
  addDoc, 
  query, 
  where,
  onSnapshot, 
  orderBy, 
  limit, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { AdminMessage, MessageStats, MessageFormData } from '../types/messaging';

class MessagingService {
  // Envoyer un message depuis l'admin
  async sendMessage(messageData: MessageFormData, senderId: string, senderName: string): Promise<string> {
    try {
      const messagePayload = {
        title: messageData.title,
        content: messageData.content,
        type: messageData.type,
        targetUsers: messageData.targetUsers === 'specific' ? messageData.selectedUsers : undefined,
        senderId,
        senderName,
        priority: messageData.priority,
        createdAt: serverTimestamp(),
        readBy: []
      };

      const messageRef = await addDoc(collection(db, 'admin_messages'), messagePayload);

      // Appeler la fonction cloud pour créer les notifications
      await this.createNotificationsForUsers(messageRef.id, messagePayload);

      return messageRef.id;
    } catch (error) {
      console.error('Error sending admin message:', error);
      throw error;
    }
  }

  // Créer les notifications pour les utilisateurs
  async createNotificationsForUsers(messageId: string, messageData: any): Promise<void> {
    try {
      let targetUsers: string[] = [];

      if (messageData.targetUsers && messageData.targetUsers.length > 0) {
        targetUsers = messageData.targetUsers;
      } else {
        // Récupérer tous les utilisateurs actifs
        const usersSnapshot = await getDocs(collection(db, 'users'));
        targetUsers = usersSnapshot.docs.map(doc => doc.id);
      }

      // Créer une notification pour chaque utilisateur
      const notifications = targetUsers.map(userId => ({
        messageId,
        userId,
        title: messageData.title,
        content: messageData.content,
        type: messageData.type,
        isRead: false,
        priority: messageData.priority || 'medium',
        createdAt: serverTimestamp()
      }));

      // Ajouter toutes les notifications en batch
      const notificationsRef = collection(db, 'user_notifications');
      await Promise.all(notifications.map(notification => 
        addDoc(notificationsRef, notification)
      ));

      // optionally call cloud function for push if available
      // (admin environment may not have functions imported)
    } catch (error) {
      console.error('Error creating user notifications:', error);
      throw error;
    }
  }

  // Écouter les messages envoyés par l'admin
  listenToAdminMessages(callback: (messages: AdminMessage[]) => void): () => void {
    const q = query(
      collection(db, 'admin_messages'),
      where('deleted', '!=', true),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminMessage[];
      
      // Trier par date en JS pour éviter l'erreur "requires index"
      const sortedMessages = messages.sort((a, b) => {
        const t1 = (a.createdAt as any)?.seconds || 0;
        const t2 = (b.createdAt as any)?.seconds || 0;
        return t2 - t1;
      });
      
      callback(sortedMessages);
    });
  }

  // Récupérer les statistiques des messages
  async getMessageStats(): Promise<MessageStats> {
    try {
      const messagesSnapshot = await getDocs(collection(db, 'admin_messages'));
      const messages = messagesSnapshot.docs.map(doc => doc.data() as AdminMessage);
      
      const notificationsSnapshot = await getDocs(collection(db, 'user_notifications'));
      const notifications = notificationsSnapshot.docs.map(doc => doc.data() as any);

      const totalSent = messages.length;
      const totalRead = notifications.filter(n => n.isRead).length;
      const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

      const byType = {
        announcement: messages.filter(m => m.type === 'announcement').length,
        notification: messages.filter(m => m.type === 'notification').length,
        support: messages.filter(m => m.type === 'support').length
      };

      return {
        totalSent,
        totalRead,
        readRate,
        byType
      };
    } catch (error) {
      console.error('Error getting message stats:', error);
      return {
        totalSent: 0,
        totalRead: 0,
        readRate: 0,
        byType: {
          announcement: 0,
          notification: 0,
          support: 0
        }
      };
    }
  }

  // Récupérer la liste des utilisateurs pour le ciblage
  async getUsersList(): Promise<Array<{id: string, username: string, email: string}>> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      return usersSnapshot.docs.map(doc => ({
        id: doc.id,
        username: doc.data().username || '',
        email: doc.data().email || ''
      }));
    } catch (error) {
      console.error('Error getting users list:', error);
      return [];
    }
  }

  // Récupérer les utilisateurs avec des transactions en attente
  async getUsersWithPendingPayments(): Promise<Array<{id: string, username: string, email: string}>> {
    try {
      // Chercher dans la collection pending_payments
      const pendingSnapshot = await getDocs(collection(db, 'pending_payments'));
      const pendingUsers: Array<{id: string, username: string, email: string}> = [];
      
      for (const doc of pendingSnapshot.docs) {
        const pendingData = doc.data();
        if (pendingData.userId && pendingData.username) {
          pendingUsers.push({
            id: pendingData.userId,
            username: pendingData.username,
            email: pendingData.email || ''
          });
        }
      }
      
      // Éliminer les doublons
      const uniqueUsers = pendingUsers.filter((user, index, self) => 
        index === self.findIndex((u) => u.id === user.id)
      );
      
      return uniqueUsers;
    } catch (error) {
      console.error('Error getting users with pending payments:', error);
      return [];
    }
  }

  // Supprimer un message
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'admin_messages', messageId), {
        deleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Envoie une notification de type support à un utilisateur unique.
   */
  async notifyUser(userId: string, content: string): Promise<void> {
    const messageId = `support-${Date.now()}`;
    const messageData = {
      title: 'Réponse du support',
      content,
      type: 'support',
      targetUsers: [userId],
      priority: 'high'
    };
    await this.createNotificationsForUsers(messageId, messageData);
  }
}

export const messagingService = new MessagingService();
