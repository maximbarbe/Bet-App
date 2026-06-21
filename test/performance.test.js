const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

async function loadPerformanceModule() {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'js', 'performance.js'), 'utf8');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}

test('sortBets orders decimal odds in both directions', async () => {
  const { sortBets } = await loadPerformanceModule();
  const bets = [{ odds: 1.75 }, { odds: 2.125 }, { odds: 1.975 }];

  assert.deepEqual(sortBets(bets, 'odds-asc').map(bet => bet.odds), [1.75, 1.975, 2.125]);
  assert.deepEqual(sortBets(bets, 'odds-desc').map(bet => bet.odds), [2.125, 1.975, 1.75]);
});

test('buildLeaderboard excludes pending bets and ranks groups by net profit', async () => {
  const { buildLeaderboard } = await loadPerformanceModule();
  const bets = [
    { sport: 'Soccer', line: 'Total Goals', outcome: 'win', profit: 15, stake: 10 },
    { sport: 'soccer', line: 'Total Goals', outcome: 'loss', profit: -5, stake: 5 },
    { sport: 'Tennis', line: 'Match Winner', outcome: 'half-win', profit: 6, stake: 12 },
    { sport: 'Tennis', line: 'Match Winner', outcome: 'pending', profit: null, stake: 100 }
  ];

  const sports = buildLeaderboard(bets, 'sport');

  assert.equal(sports.length, 2);
  assert.deepEqual(sports.map(entry => entry.label), ['Soccer', 'Tennis']);
  assert.equal(sports[0].profit, 10);
  assert.equal(sports[0].bets, 2);
  assert.equal(sports[0].wins, 1);
  assert.equal(sports[0].losses, 1);
  assert.equal(sports[1].profit, 6);
  assert.equal(sports[1].bets, 1);
});
