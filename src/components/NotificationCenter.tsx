import { useState, useEffect } from 'react';
import { AdminNotification, NotificationService, ADMIN_USER_ID } from '../services/NotificationService';
import { X, CheckCircle, Info, AlertTriangle, DollarSign, Trophy, User } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = NotificationService.subscribeToNotifications(ADMIN_USER_ID, (list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    await NotificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await NotificationService.markAllAsRead(ADMIN_USER_ID);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-96 bg-white h-full shadow-xl p-4 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              className="text-sm text-blue-600 hover:underline"
              onClick={handleMarkAllAsRead}
            >
              Tout lire
            </button>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        {notifications.length === 0 ? (
          <p className="text-gray-500">Aucune notification pour le moment.</p>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-3 mb-2 rounded-lg cursor-pointer ${
                n.read ? 'bg-gray-100' : 'bg-blue-50'
              }`}
              onClick={() => !n.read && handleMarkAsRead(n.id)}
            >
              <div>
                {n.type === 'MATCH' && <Trophy />}
                {n.type === 'PAYMENT' && <DollarSign />}
                {n.type === 'INFO' && <Info />}
                {n.type === 'WARNING' && <AlertTriangle />}
                {n.type === 'SUCCESS' && <CheckCircle />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{n.title}</p>
                <p className="text-sm text-gray-600">{n.message}</p>
                <p className="text-xs text-gray-400">
                  {n.timestamp.toDate().toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
