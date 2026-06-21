const SETTLED_OUTCOMES = new Set(['win', 'loss', 'push', 'half-win', 'half-loss']);

export function sortBets(bets, sortMode) {
  const sorted = [...bets];

  if (sortMode === 'odds-asc') {
    return sorted.sort((left, right) => Number(left.odds) - Number(right.odds));
  }

  if (sortMode === 'odds-desc') {
    return sorted.sort((left, right) => Number(right.odds) - Number(left.odds));
  }

  return sorted.sort((left, right) => new Date(right.date) - new Date(left.date));
}

export function buildLeaderboard(bets, groupField) {
  const groups = new Map();

  for (const bet of bets) {
    if (!SETTLED_OUTCOMES.has(bet.outcome)) continue;

    const label = String(bet[groupField] || 'Unspecified').trim() || 'Unspecified';
    const key = label.toLocaleLowerCase();
    const entry = groups.get(key) || {
      label,
      profit: 0,
      stake: 0,
      bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0
    };

    entry.profit += Number(bet.profit) || 0;
    entry.stake += Number(bet.stake) || 0;
    entry.bets += 1;

    if (bet.outcome.includes('win')) entry.wins += 1;
    else if (bet.outcome.includes('loss')) entry.losses += 1;
    else entry.pushes += 1;

    groups.set(key, entry);
  }

  return [...groups.values()]
    .map(entry => ({
      ...entry,
      roi: entry.stake ? (entry.profit / entry.stake) * 100 : 0
    }))
    .sort((left, right) => right.profit - left.profit || right.roi - left.roi || left.label.localeCompare(right.label));
}
