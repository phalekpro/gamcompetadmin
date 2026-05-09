export interface AdminMessage {
  id: string;
  title: string;
  content: string;
  type: 'announcement' | 'notification' | 'support';
  targetUsers?: string[]; // IDs of specific users, undefined = all users
  senderId: string;
  senderName: string;
  createdAt: any;
  readBy?: string[]; // User IDs who have read the message
  priority?: 'low' | 'medium' | 'high';
}

export interface UserNotification {
  id: string;
  messageId: string;
  userId: string;
  title: string;
  content: string;
  type: 'announcement' | 'notification' | 'support';
  isRead: boolean;
  createdAt: any;
  priority: 'low' | 'medium' | 'high';
}

export interface MessageStats {
  totalSent: number;
  totalRead: number;
  readRate: number;
  byType: {
    announcement: number;
    notification: number;
    support: number;
  };
}

export interface MessageFormData {
  title: string;
  content: string;
  type: 'announcement' | 'notification' | 'support';
  targetUsers: 'all' | 'specific';
  selectedUsers?: string[];
  priority: 'low' | 'medium' | 'high';
}
