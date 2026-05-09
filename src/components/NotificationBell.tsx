import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { NotificationService, AdminNotification, ADMIN_USER_ID } from '../services/NotificationService';
import NotificationCenter from './NotificationCenter';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    let prevList: AdminNotification[] = [];

    const unsubscribe = NotificationService.subscribeToNotifications(ADMIN_USER_ID, (list) => {
      const unread = list.filter(n => !n.read).length;
      
      if (Notification.permission === 'granted') {
        const newItems = list.filter(n => !prevList.find(x => x.id === n.id));
        newItems.forEach(n => {
          new Notification(n.title, { body: n.message });
        });
      }
      
      prevList = list;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <button
        className="relative p-2 rounded-full hover:bg-gray-100"
        onClick={() => setIsOpen(true)}
        title="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
