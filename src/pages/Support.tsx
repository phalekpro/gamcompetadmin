import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MessageSquare, Send, User as UserIcon, Search, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    text: string;
    senderId: string;
    senderRole: 'user' | 'admin';
    createdAt: any;
}

interface ChatSession {
    userId: string;
    userName: string;
    lastMessage?: string;
    lastActivity?: any;
}

export default function Support() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [selectedUser, setSelectedUser] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Charger toutes les sessions de chat
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const supportRef = collection(db, 'support_chats');
                const snapshot = await getDocs(supportRef);

                const sessionsData = await Promise.all(snapshot.docs.map(async (chatDoc) => {
                    // Pour chaque chat, on pourrait récupérer le nom de l'utilisateur
                    // Mais pour l'instant on se base sur les IDs
                    const userData = chatDoc.data();
                    return {
                        userId: chatDoc.id,
                        userName: userData.userName || `Utilisateur ${chatDoc.id.slice(0, 5)}`,
                        lastMessage: userData.lastMessage,
                        lastActivity: userData.lastActivity
                    };
                }));

                setSessions(sessionsData.sort((a, b) => (b.lastActivity?.seconds || 0) - (a.lastActivity?.seconds || 0)));
                setLoading(false);
            } catch (error) {
                console.error('Error fetching sessions:', error);
                toast.error('Erreur lors du chargement des chats');
            }
        };

        fetchSessions();
    }, []);

    // Écouter les messages du chat sélectionné
    useEffect(() => {
        if (!selectedUser) {
            setMessages([]);
            return;
        }

        const messagesRef = collection(db, 'support_chats', selectedUser.userId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[];
            setMessages(msgs);
            setTimeout(scrollToBottom, 100);
        });

        return () => unsubscribe();
    }, [selectedUser]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!selectedUser || !inputText.trim()) return;

        const text = inputText.trim();
        setInputText('');

        try {
            const messagesRef = collection(db, 'support_chats', selectedUser.userId, 'messages');
            const docRef = await addDoc(messagesRef, {
                text,
                senderId: 'admin',
                senderRole: 'admin',
                createdAt: serverTimestamp()
            });

            // Mettre à jour le document racine du chat pour refléter l'activité
            // merge: true in case the document doesn't yet exist
            await setDoc(doc(db, 'support_chats', selectedUser.userId), {
                lastMessage: text,
                lastActivity: serverTimestamp(),
                userName: selectedUser.userName
            }, { merge: true });
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Erreur d\'envoi');
        }

        // envoi de notification push + notification utilisateur
        try {
            await messagingService.notifyUser(selectedUser.userId, text);
        } catch (notifErr) {
            console.error('Erreur création notification support:', notifErr);
        }
    };

    const filteredSessions = sessions.filter(s =>
        s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-[calc(100vh-140px)] flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Sidebar des conversations */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/30">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Support Direct</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher un joueur..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">Chargement...</div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">Aucun chat trouvé</div>
                    ) : (
                        filteredSessions.map((session) => (
                            <button
                                key={session.userId}
                                onClick={() => setSelectedUser(session)}
                                className={`w-full p-4 flex items-start gap-3 border-b border-gray-100 transition-colors hover:bg-white ${selectedUser?.userId === session.userId ? 'bg-white border-l-4 border-primary' : ''
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <UserIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-bold text-sm text-gray-900 truncate">{session.userName}</p>
                                        {session.lastActivity && (
                                            <span className="text-[10px] text-gray-400">
                                                {session.lastActivity.toDate().toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                        {session.lastMessage || 'Nouvelle conversation'}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Zone de Chat */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedUser ? (
                    <>
                        {/* Header du Chat */}
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                                    <UserIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{selectedUser.userName}</p>
                                    <p className="text-xs text-green-500 font-medium">En ligne</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                                    <Search className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            className="flex-1 overflow-y-auto p-6 space-y-4"
                            style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                        >
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[70%] ${msg.senderRole === 'admin' ? 'order-2' : ''}`}>
                                        <div className={`px-4 py-2 rounded-2xl shadow-sm ${msg.senderRole === 'admin'
                                                ? 'bg-primary text-white rounded-tr-none'
                                                : 'bg-gray-100 text-gray-900 rounded-tl-none border border-gray-200'
                                            }`}>
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                            <div className={`flex items-center gap-1 mt-1 justify-end ${msg.senderRole === 'admin' ? 'text-white/70' : 'text-gray-400'}`}>
                                                <span className="text-[10px]">
                                                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                                </span>
                                                {msg.senderRole === 'admin' && <CheckCheck className="w-3 h-3" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-200 bg-white">
                            <form onSubmit={handleSendMessage} className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Écrivez votre réponse..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="bg-primary text-white p-3 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                            <MessageSquare className="w-10 h-10 text-gray-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">Sélectionnez une conversation</p>
                            <p className="text-sm">Choisissez un utilisateur dans la liste pour commencer à chatter.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
