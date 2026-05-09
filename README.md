# GameCompet Admin Dashboard

Application d'administration pour la plateforme GameCompet E-Sport.

## 🚀 Fonctionnalités

### Dashboard
- Vue d'ensemble des statistiques en temps réel
- Graphiques d'activité hebdomadaire
- Graphiques de revenus mensuels
- Métriques clés (utilisateurs, tournois, matchs, litiges)

### Gestion Utilisateurs
- Liste complète des utilisateurs
- Recherche et filtres (vérifiés/non vérifiés)
- Validation de compte (isVerified)
- Promotion Pro/Amateur
- Visualisation des statistiques utilisateur

### Gestion Tournois
- Création de nouveaux tournois
- Configuration complète (jeu, frais, prize pool, dates)
- Gestion du statut (open → in_progress → completed)
- Visualisation des participants
- Démarrage et clôture de tournois

### Gestion Matchs
- Liste de tous les matchs
- Filtres par statut (pending, in_progress, completed, disputed)
- Visualisation des preuves (screenshots)
- Validation manuelle des résultats
- Résolution des conflits

### Gestion Litiges
- Liste des litiges ouverts/en cours/résolus
- Examen des preuves (images, vidéos)
- Résolution avec commentaire
- Historique des décisions

### Gestion Transactions
- Vue d'ensemble financière
- Liste de toutes les transactions
- Validation/rejet des retraits
- Filtres par statut et type
- Statistiques de revenus

### Classement
- Visualisation du leaderboard complet
- Top 3 mis en avant
- Statistiques détaillées par joueur
- Tendances (up/down/neutral)

## 📦 Installation

```bash
cd admin
npm install
```

## 🔧 Configuration

L'application utilise la même configuration Firebase que l'application client.
Les credentials sont dans `src/firebase.ts`.

## 🏃 Démarrage

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3001`

## 🔐 Connexion Admin

Pour se connecter, vous devez avoir un compte utilisateur avec `role: "admin"` dans Firestore.

### Créer un admin manuellement

1. Créez un compte utilisateur normal via l'app client
2. Dans Firestore, modifiez le document de l'utilisateur:
```javascript
{
  ...
  role: "admin"  // Ajoutez ce champ
}
```

## 🏗️ Structure du Projet

```
admin/
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Layout principal avec sidebar
│   ├── contexts/
│   │   └── AuthContext.tsx     # Gestion authentification admin
│   ├── pages/
│   │   ├── Login.tsx           # Page de connexion
│   │   ├── Dashboard.tsx       # Dashboard principal
│   │   ├── Users.tsx           # Gestion utilisateurs
│   │   ├── Tournaments.tsx     # Gestion tournois
│   │   ├── Matches.tsx         # Gestion matchs
│   │   ├── Disputes.tsx        # Gestion litiges
│   │   ├── Transactions.tsx    # Gestion transactions
│   │   └── Leaderboard.tsx     # Classement
│   ├── App.tsx                 # Composant principal
│   ├── firebase.ts             # Configuration Firebase
│   ├── types.ts                # Types TypeScript
│   └── main.tsx                # Point d'entrée
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎨 Technologies

- **React 18** - Framework UI
- **TypeScript** - Typage statique
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Firebase** - Backend (Auth, Firestore, Storage)
- **Recharts** - Graphiques
- **Lucide React** - Icônes
- **React Hot Toast** - Notifications

## 🔒 Sécurité

- Authentification requise pour toutes les pages
- Vérification du rôle admin côté client et serveur
- Protection des routes via ProtectedRoute
- Règles Firestore pour limiter l'accès admin

## 📝 TODO

- [ ] Système de notifications en temps réel
- [ ] Export de données (CSV, Excel)
- [ ] Gestion des rôles (super admin, moderator)
- [ ] Logs d'activité admin
- [ ] Système de chat avec utilisateurs
- [ ] Génération automatique de brackets
- [ ] Intégration OCR pour validation preuves
- [ ] Dashboard analytics avancé
- [ ] Gestion des bannissements
- [ ] Système de modération contenu

## 🤝 Contribution

Cette application fait partie du projet GameCompet E-Sport Platform.

## 📄 License

Propriétaire - GameCompet 2026
