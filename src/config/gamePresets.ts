/**
 * Presets de configuration par jeu pour les championnats GameCompète.
 * Chaque jeu possède ses propres règles, champs d'inscription et paramètres par défaut.
 */

export interface GamePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  modes: string[];
  defaultMode: string;
  // Champs d'inscription spécifiques
  registrationFields: RegistrationField[];
  // Paramètres du championnat
  defaultEntryFee: number;
  defaultMaxPlayers: number;
  defaultMaxMatchesPerPlayer: number;
  defaultMaxMatchesVsOpponent: number;
  defaultPointsSystem: { win: number; draw: number; loss: number };
  // Règles spécifiques au jeu
  rules: string[];
  // Anti-triche spécifique
  proofRequirements: string[];
  // Couleur d'accent UI
  accentColor: string;
  badgeColor: string;
}

export interface RegistrationField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: { min?: number; max?: number; pattern?: string };
}

export const GAME_PRESETS: Record<string, GamePreset> = {
  'call_of_duty_mobile': {
    id: 'call_of_duty_mobile',
    name: 'Call of Duty Mobile',
    emoji: '🔫',
    description: 'Championnat 1v1 ou Battle Royale',
    modes: ['Multijoueur (MJ)', 'Battle Royale'],
    defaultMode: 'Multijoueur (MJ)',
    registrationFields: [
      {
        key: 'uid',
        label: 'UID (User ID)',
        type: 'text',
        required: true,
        placeholder: 'Ton UID à 19 ou 20 chiffres (ex: 674...901)',
      },
      {
        key: 'inGameName',
        label: 'Pseudo exact en jeu',
        type: 'text',
        required: true,
        placeholder: 'Respecte les majuscules et caractères spéciaux',
      },
    ],
    defaultEntryFee: 1500,
    defaultMaxPlayers: 32,
    defaultMaxMatchesPerPlayer: 30,
    defaultMaxMatchesVsOpponent: 10,
    defaultPointsSystem: { win: 3, draw: 1, loss: 0 },
    rules: [
      'Fournir son UID exact est obligatoire.',
      'En Multijoueur : Mode Duel 1v1.',
      'Screenshot de l\'écran de Victoire obligatoire avec les Kills affichés.',
    ],
    proofRequirements: [
      'L\'écran de Victoire/Défaite',
      'Les pseudos des deux joueurs doivent être visibles'
    ],
    accentColor: '#e8b722',
    badgeColor: 'bg-yellow-100 text-yellow-800',
  },

  'clash_royale': {
    id: 'clash_royale',
    name: 'Clash Royale',
    emoji: '👑',
    description: 'Championnat 1v1 duels de cartes',
    modes: ['1v1 Duel', '1v1 Duel Bo3'],
    defaultMode: '1v1 Duel',
    registrationFields: [
      {
        key: 'playerTag',
        label: 'Tag de joueur (Player Tag)',
        type: 'text',
        required: true,
        placeholder: 'Ex: #YRQP0PJ (N\'oublie pas le #)',
      },
      {
        key: 'inGameName',
        label: 'Pseudo en jeu',
        type: 'text',
        required: true,
        placeholder: 'Ton pseudo Clash Royale',
      },
    ],
    defaultEntryFee: 1500,
    defaultMaxPlayers: 32,
    defaultMaxMatchesPerPlayer: 30,
    defaultMaxMatchesVsOpponent: 10,
    defaultPointsSystem: { win: 3, draw: 1, loss: 0 },
    rules: [
      'Format : Best of 1 (sauf mode Bo3)',
      'Match en mode "Duel amical" uniquement',
      'Capture d\'écran de la fin du match obligatoire montrant les couronnes.',
    ],
    proofRequirements: [
      'Le tableau des scores de fin de partie',
      'Les couronnes détruites par chaque joueur doivent être visibles'
    ],
    accentColor: '#8b5cf6',
    badgeColor: 'bg-purple-100 text-purple-800',
  },

  'free_fire': {
    id: 'free_fire',
    name: 'Free Fire',
    emoji: '🔥',
    description: 'Championnat Battle Royale ou Clash Squad',
    modes: ['Clash Squad (CS) 1v1', 'Battle Royale Solo'],
    defaultMode: 'Clash Squad (CS) 1v1',
    registrationFields: [
      {
        key: 'uid',
        label: 'UID de joueur',
        type: 'number',
        required: true,
        placeholder: 'Ton UID composé de chiffres',
      },
      {
        key: 'inGameName',
        label: 'Pseudo exact (IGN)',
        type: 'text',
        required: true,
        placeholder: 'Ton pseudo avec symboles inclus',
      },
    ],
    defaultEntryFee: 1500,
    defaultMaxPlayers: 32,
    defaultMaxMatchesPerPlayer: 30,
    defaultMaxMatchesVsOpponent: 10,
    defaultPointsSystem: { win: 3, draw: 1, loss: 0 },
    rules: [
      'Match en salle personnalisée.',
      'Screenshot de l\'écran BOOYAH / Classement final obligatoire.',
    ],
    proofRequirements: [
      'Écran de résultat de fin de match',
      'Le nombre de Kills ou le placement (Top) doit être visible'
    ],
    accentColor: '#f97316',
    badgeColor: 'bg-orange-100 text-orange-800',
  },

  'efootball': {
    id: 'efootball',
    name: 'eFootball Mobile',
    emoji: '⚽',
    description: 'Championnat 1v1 de football virtuel',
    modes: ['1v1 Standard'],
    defaultMode: '1v1 Standard',
    registrationFields: [
      {
        key: 'ownerId',
        label: 'ID Propriétaire (Owner ID)',
        type: 'text',
        required: true,
        placeholder: 'Ton ID à 9 chiffres (ex: 123-456-789)',
      },
      {
        key: 'inGameName',
        label: 'Nom de l\'équipe (Dream Team)',
        type: 'text',
        required: true,
        placeholder: 'Ex: FC Champions',
      },
    ],
    defaultEntryFee: 1500,
    defaultMaxPlayers: 32,
    defaultMaxMatchesPerPlayer: 30,
    defaultMaxMatchesVsOpponent: 10,
    defaultPointsSystem: { win: 3, draw: 1, loss: 0 },
    rules: [
      'Durée du match : 6 ou 8 minutes (selon entente)',
      'Screenshot de l\'écran de résultat avec le score et les équipes.',
    ],
    proofRequirements: [
      'Capture d\'écran du résultat final du match',
      'Le score exact doit être clairement lisible'
    ],
    accentColor: '#22c55e',
    badgeColor: 'bg-green-100 text-green-800',
  },
};

export const SUPPORTED_GAMES = Object.values(GAME_PRESETS);

export function getGamePreset(gameId: string): GamePreset | undefined {
  return GAME_PRESETS[gameId];
}

export function getGameById(gameId: string): GamePreset | undefined {
  return Object.values(GAME_PRESETS).find(g => g.id === gameId || g.name === gameId);
}
