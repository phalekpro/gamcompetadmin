import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    Unsubscribe,
    limit
} from "firebase/firestore";
import { db } from "../firebase";

export interface AdminNotification {
    id: string;
    userId: string; // in our case will be ADMIN_USER_ID constant
    title: string;
    message: string;
    type: 'MATCH' | 'PAYMENT' | 'INFO' | 'WARNING' | 'SUCCESS';
    read: boolean;
    timestamp: Timestamp;
    link?: string;
}

export const ADMIN_USER_ID = 'admin';

export const NotificationService = {
    subscribeToNotifications(
        userId: string,
        callback: (notifications: AdminNotification[]) => void
    ): Unsubscribe {
        const notificationsRef = collection(db, "Notifications");
        const q = query(
            notificationsRef,
            where("userId", "==", userId),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        return onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AdminNotification));
            callback(list);
        });
    },

    async markAsRead(notificationId: string): Promise<void> {
        const docRef = doc(db, "Notifications", notificationId);
        await updateDoc(docRef, { read: true });
    },

    async markAllAsRead(userId: string): Promise<void> {
        const notificationsRef = collection(db, "Notifications");
        const q = query(
            notificationsRef,
            where("userId", "==", userId),
            where("read", "==", false)
        );

        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(d => updateDoc(doc(db, "Notifications", d.id), { read: true }));
        await Promise.all(batch);
    },

    async sendNotification(data: Omit<AdminNotification, 'id' | 'read' | 'timestamp'>): Promise<string> {
        const notificationsRef = collection(db, "Notifications");
        const newDoc = doc(notificationsRef);

        const notificationData = {
            ...data,
            read: false,
            timestamp: Timestamp.now()
        };

        await setDoc(newDoc, notificationData);
        return newDoc.id;
    }
};
