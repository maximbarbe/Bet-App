export const resultOf = (bet) => bet.outcome || 'pending';

// Settlement rules use net profit, not the total amount returned.
export function calculateProfit(outcome, odds, stake) {
  const profitByOutcome = {
    pending: null,
    win: stake * (odds - 1),
    loss: -stake,
    push: 0,
    'half-win': stake * (odds - 1) / 2,
    'half-loss': -stake / 2
  };
  return profitByOutcome[outcome];
}

// Remove the reference market's margin by normalizing implied probabilities.
export function proportionalDevig(outcomes, bankroll) {
  const impliedTotal = outcomes.reduce((sum, item) => sum + 1 / item.sharp, 0);
  const results = outcomes.map(item => {
    const fairProbability = (1 / item.sharp) / impliedTotal;
    const offeredImplied = 1 / item.offered;
    const expectedEdge = fairProbability * item.offered - 1;
    const fullKelly = expectedEdge / (item.offered - 1);
    const quarterKelly = Math.max(0, fullKelly / 4);

    return {
      ...item,
      fairProbability,
      offeredImplied,
      probabilityEdge: fairProbability - offeredImplied,
      expectedEdge,
      quarterKelly,
      stake: bankroll * quarterKelly
    };
  });

  return { impliedTotal, results };
}
