/**
 * Utilitaires pour la gestion intelligente des brackets de tournoi
 */

export interface RoundInfo {
  key: string;
  name: string;
  displayName: string;
  matchCount: number;
  order: number;
}

/**
 * Crée un bracket vide avec tous les matchs marqués "Pas encore déterminé"
 */
export function createEmptyBracket(maxParticipants: number): any {
  const rounds = calculateTournamentRounds(maxParticipants);
  const bracket: any = {
    rounds: {},
    currentRound: rounds[0]?.key || null,
    matchMakingDone: false
  };

  // Créer les matchs vides pour chaque tour
  rounds.forEach(round => {
    bracket.rounds[round.key] = [];
    
    for (let i = 0; i < round.matchCount; i++) {
      bracket.rounds[round.key].push({
        id: `${round.key}_match_${i + 1}`,
        matchNumber: i + 1,
        player1: null, // Sera rempli lors du match making
        player2: null, // Sera rempli lors du match making
        winnerId: null,
        status: 'scheduled'
      });
    }
  });

  return bracket;
}

/**
 * Calcule les tours nécessaires en fonction du nombre de participants
 * Retourne uniquement les tours qui seront joués
 */
export function calculateTournamentRounds(participantCount: number): RoundInfo[] {
  const rounds: RoundInfo[] = [];
  
  // Trouver la puissance de 2 la plus proche (arrondie au supérieur)
  const nearestPowerOf2 = Math.pow(2, Math.ceil(Math.log2(participantCount)));
  
  let currentSize = nearestPowerOf2;
  let order = 0;
  
  // Générer les tours du premier au dernier
  while (currentSize >= 2) {
    const matchCount = currentSize / 2;
    
    let roundInfo: RoundInfo;
    
    if (currentSize === 256) {
      roundInfo = {
        key: 'round_of_128',
        name: '1er Tour',
        displayName: '1er Tour (128 matchs)',
        matchCount: 128,
        order: order++
      };
    } else if (currentSize === 128) {
      roundInfo = {
        key: 'round_of_64',
        name: '2ème Tour',
        displayName: '2ème Tour (64 matchs)',
        matchCount: 64,
        order: order++
      };
    } else if (currentSize === 64) {
      roundInfo = {
        key: 'round_of_32',
        name: '3ème Tour',
        displayName: '3ème Tour (32 matchs)',
        matchCount: 32,
        order: order++
      };
    } else if (currentSize === 32) {
      roundInfo = {
        key: 'round_of_16',
        name: '16èmes de finale',
        displayName: '16èmes de finale',
        matchCount: 16,
        order: order++
      };
    } else if (currentSize === 16) {
      roundInfo = {
        key: 'round_of_8',
        name: '8èmes de finale',
        displayName: '8èmes de finale',
        matchCount: 8,
        order: order++
      };
    } else if (currentSize === 8) {
      roundInfo = {
        key: 'quarter_finals',
        name: 'Quarts de finale',
        displayName: 'Quarts de finale',
        matchCount: 4,
        order: order++
      };
    } else if (currentSize === 4) {
      roundInfo = {
        key: 'semi_finals',
        name: 'Demi-finales',
        displayName: 'Demi-finales',
        matchCount: 2,
        order: order++
      };
    } else if (currentSize === 2) {
      roundInfo = {
        key: 'grand_final',
        name: 'Grande Finale',
        displayName: 'Grande Finale',
        matchCount: 1,
        order: order++
      };
    } else {
      // Pour les tailles non standard, on génère un nom générique
      roundInfo = {
        key: `round_of_${currentSize}`,
        name: `Tour ${order + 1}`,
        displayName: `Tour ${order + 1} (${matchCount} matchs)`,
        matchCount,
        order: order++
      };
    }
    
    rounds.push(roundInfo);
    currentSize = currentSize / 2;
  }
  
  return rounds;
}

/**
 * Obtient le nom d'affichage d'un tour
 */
export function getRoundDisplayName(roundKey: string): string {
  const roundNames: { [key: string]: string } = {
    'round_of_128': '1er Tour',
    'round_of_64': '2ème Tour',
    'round_of_32': '3ème Tour',
    'round_of_16': '16èmes de finale',
    'round_of_8': '8èmes de finale',
    'quarter_finals': 'Quarts de finale',
    'semi_finals': 'Demi-finales',
    'grand_final': 'Grande Finale'
  };
  
  return roundNames[roundKey] || roundKey;
}

/**
 * Obtient le nom court d'un tour pour les onglets
 */
export function getRoundShortName(roundKey: string): string {
  const shortNames: { [key: string]: string } = {
    'round_of_128': '1er Tour',
    'round_of_64': '2ème Tour',
    'round_of_32': '3ème Tour',
    'round_of_16': '16èmes',
    'round_of_8': '8èmes',
    'quarter_finals': 'Quarts',
    'semi_finals': 'Demi',
    'grand_final': 'Finale'
  };
  
  return shortNames[roundKey] || roundKey;
}