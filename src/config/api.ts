/**
 * Configuration API centralisée pour l'Admin Dashboard
 * Utilise l'URL du backend déployé en production
 */

// En production, utilise le backend déployé sur Render
// En développement, utilise le serveur local
const API_URL = import.meta.env.VITE_API_URL ||
    'https://us-central1-gamecompet-6f5e9.cloudfunctions.net/api';

console.log('🌐 [ADMIN] API URL:', API_URL, '| Mode:', import.meta.env.MODE);

/**
 * Tous les endpoints de l'API pour l'admin
 */
export const API_ENDPOINTS = {
    // Base
    health: `${API_URL}/`,

    // Authentication
    auth: {
        login: `${API_URL}/api/auth/login`,
        logout: `${API_URL}/api/auth/logout`,
    },

    // Users Management
    users: {
        base: `${API_URL}/api/users`,
        detail: (userId: string) => `${API_URL}/api/users/${userId}`,
        update: (userId: string) => `${API_URL}/api/users/${userId}`,
        delete: (userId: string) => `${API_URL}/api/users/${userId}`,
    },

    // Tournaments Management
    tournaments: {
        base: `${API_URL}/api/tournaments`,
        detail: (tournamentId: string) => `${API_URL}/api/tournaments/${tournamentId}`,
        create: `${API_URL}/api/tournaments`,
        update: (tournamentId: string) => `${API_URL}/api/tournaments/${tournamentId}`,
        delete: (tournamentId: string) => `${API_URL}/api/tournaments/${tournamentId}`,
        participants: (tournamentId: string) => `${API_URL}/api/tournaments/${tournamentId}/participants`,
        approve: (tournamentId: string, userId: string) =>
            `${API_URL}/api/tournaments/${tournamentId}/participants/${userId}/approve`,
    },

    // Matches Management
    matches: {
        base: `${API_URL}/api/matches`,
        detail: (matchId: string) => `${API_URL}/api/matches/${matchId}`,
        create: `${API_URL}/api/matches`,
        update: (matchId: string) => `${API_URL}/api/matches/${matchId}`,
        validate: (matchId: string) => `${API_URL}/api/matches/${matchId}/validate`,
        reports: (matchId: string) => `${API_URL}/api/matches/${matchId}/reports`,
    },

    // Payments / Webhooks
    payments: {
        webhook: `${API_URL}/api/payments/webhook`,
        history: (apiKey: string) => `${API_URL}/api/payments/webhook?key=${apiKey}`,
    },

    // Leaderboard Management
    leaderboard: {
        export: `${API_URL}/api/leaderboard/export`,
        stats: `${API_URL}/api/leaderboard/stats`,
        resetSeason: `${API_URL}/api/leaderboard/reset-season`,
    },
};

/**
 * Helper pour construire des URLs avec query params
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return endpoint;

    const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    return `${endpoint}?${queryString}`;
}

/**
 * Helper pour les requêtes admin avec authentification
 */
export async function adminApiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    try {
        // Récupérer le token admin depuis le localStorage
        const adminToken = localStorage.getItem('adminToken');

        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(adminToken && { 'Authorization': `Bearer ${adminToken}` }),
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));

            // Si 401, rediriger vers login
            if (response.status === 401) {
                localStorage.removeItem('adminToken');
                window.location.href = '/login';
            }

            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Admin API Request Error:', error);
        throw error;
    }
}

export default API_URL;
