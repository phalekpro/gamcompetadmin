import React, { useState, useEffect } from 'react';
import { messagingService } from '../services/messagingService';
import { AdminMessage, MessageFormData, MessageStats } from '../types/messaging';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Messaging: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [users, setUsers] = useState<Array<{id: string, username: string, email: string}>>([]);
  const [pendingUsers, setPendingUsers] = useState<Array<{id: string, username: string, email: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [formData, setFormData] = useState<MessageFormData>({
    title: '',
    content: '',
    type: 'notification',
    targetUsers: 'all',
    priority: 'medium'
  });

  useEffect(() => {
    // Écouter les messages
    const unsubscribeMessages = messagingService.listenToAdminMessages((msgs) => {
      setMessages(msgs);
    });

    // Charger les statistiques
    loadStats();

    // Charger la liste des utilisateurs
    loadUsers();

    // Charger la liste des utilisateurs avec paiements en attente
    loadPendingUsers();

    return () => unsubscribeMessages();
  }, []);

  const loadStats = async () => {
    try {
      const messageStats = await messagingService.getMessageStats();
      setStats(messageStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const usersList = await messagingService.getUsersList();
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadPendingUsers = async () => {
    try {
      const pendingUsersList = await messagingService.getUsersWithPendingPayments();
      setPendingUsers(pendingUsersList);
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.')) {
      return;
    }

    try {
      await messagingService.deleteMessage(messageId);
      toast.success('Message supprimé avec succès');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erreur lors de la suppression du message');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit called');
    
    if (!isAuthenticated) {
      console.log('User not authenticated');
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      console.log('Missing required fields');
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.targetUsers === 'specific' && selectedUsers.length === 0) {
      console.log('No users selected for specific targeting');
      toast.error('Veuillez sélectionner au moins un utilisateur');
      return;
    }

    console.log('Form data:', formData);
    console.log('Selected users:', selectedUsers);

    setLoading(true);
    try {
      const messageData = {
        ...formData,
        selectedUsers: formData.targetUsers === 'specific' ? selectedUsers : undefined
      };

      console.log('Sending message with data:', messageData);
      await messagingService.sendMessage(messageData, 'admin', 'Admin System');
      
      toast.success('Message envoyé avec succès');
      
      // Réinitialiser le formulaire
      setFormData({
        title: '',
        content: '',
        type: 'notification',
        targetUsers: 'all',
        priority: 'medium'
      });
      setSelectedUsers([]);
      setShowForm(false);
      
      // Recharger les statistiques
      loadStats();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    const allUserIds = users.map(user => user.id);
    setSelectedUsers(allUserIds);
  };

  const handleDeselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const handleSelectPendingUsers = () => {
    const pendingUserIds = pendingUsers.map(user => user.id);
    setSelectedUsers(pendingUserIds);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-blue-100 text-blue-800';
      case 'notification': return 'bg-green-100 text-green-800';
      case 'support': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Messagerie Admin</h1>
        <p className="text-gray-600">Envoyez des messages et notifications aux utilisateurs</p>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total envoyés</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSent}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total lus</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalRead}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Taux de lecture</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.readRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Types</h3>
            <div className="flex gap-2 mt-1">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Annonces: {stats.byType.announcement}
              </span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Notifs: {stats.byType.notification}
              </span>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Support: {stats.byType.support}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bouton d'envoi */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Annuler' : 'Nouveau message'}
        </button>
      </div>

      {/* Formulaire d'envoi */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Envoyer un nouveau message</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Titre du message"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="notification">Notification</option>
                  <option value="announcement">Annonce</option>
                  <option value="support">Support</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contenu *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Contenu du message"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinataires
                </label>
                <select
                  value={formData.targetUsers}
                  onChange={(e) => setFormData({...formData, targetUsers: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tous les utilisateurs</option>
                  <option value="specific">Utilisateurs spécifiques</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priorité
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                </select>
              </div>
            </div>

            {formData.targetUsers === 'specific' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Sélectionner les utilisateurs
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      Sélectionner tout ({users.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectPendingUsers}
                      className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 transition-colors"
                      disabled={pendingUsers.length === 0}
                    >
                      Paiements en attente ({pendingUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllUsers}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      Désélectionner tout
                    </button>
                  </div>
                </div>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {users.map((user) => {
                    const hasPendingPayment = pendingUsers.some(pendingUser => pendingUser.id === user.id);
                    return (
                      <div key={user.id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id={user.id}
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="mr-2"
                        />
                        <label htmlFor={user.id} className="text-sm flex-1">
                          {user.username} ({user.email})
                        </label>
                        {hasPendingPayment && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            ⏳ En attente
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedUsers.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedUsers.length} utilisateur{selectedUsers.length > 1 ? 's' : ''} sélectionné{selectedUsers.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des messages */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Messages envoyés</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {messages.map((message) => (
            <div key={message.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{message.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                </div>
                <div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(message.type)}`}>
                      {message.type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(message.priority || 'medium')}`}>
                      {message.priority || 'medium'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                    title="Supprimer le message"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <div>
                  Par {message.senderName} • 
                  {message.createdAt?.toDate ? message.createdAt.toDate().toLocaleString() : '...'}
                </div>
                <div>
                  {message.targetUsers ? `${message.targetUsers.length} utilisateurs ciblés` : 'Tous les utilisateurs'}
                  {message.readBy && ` • ${message.readBy.length} lus`}
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Aucun message envoyé
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messaging;
