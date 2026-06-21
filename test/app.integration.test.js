const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-'));
const databasePath = path.join(testDirectory, 'edge-test.db');
const port = 4197;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/bets`);
      if (response.ok) return;
    } catch {
      // The child process may still be opening SQLite and binding the port.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not become ready');
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

function bet(overrides = {}) {
  return {
    date: '2026-06-21T18:30',
    sport: 'Soccer',
    teamA: 'Side A',
    teamB: 'Side B',
    selection: 'Over 2.5',
    line: 'Total Goals',
    odds: 1.975,
    stake: 10,
    outcome: 'pending',
    ...overrides
  };
}

before(async () => {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: projectRoot,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_PATH: databasePath },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('serves the application and performance assets', async () => {
  const indexResponse = await fetch(baseUrl);
  const index = await indexResponse.text();
  const appResponse = await fetch(`${baseUrl}/js/app.js`);
  const appSource = await appResponse.text();

  assert.equal(indexResponse.status, 200);
  assert.equal(appResponse.status, 200);
  assert.match(index, /id="performancePage"/);
  assert.match(index, /id="completedBetHistory"/);
  assert.match(index, /id="lineLeaderboard"/);
  assert.match(index, /id="sportLeaderboard"/);
  assert.match(index, /id="sportFilter"/);
  assert.match(index, /id="betSort"/);
  assert.match(appSource, /resultOf\(bet\) !== 'pending'/);
  assert.match(appSource, /new Date\(left\.date\) - new Date\(right\.date\)/);
});

test('stores three-decimal odds and applies every settlement rule', async () => {
  const cases = [
    ['pending', null],
    ['win', 9.75],
    ['loss', -10],
    ['push', 0],
    ['half-win', 4.875],
    ['half-loss', -5]
  ];

  for (const [outcome, expectedProfit] of cases) {
    const { response, body } = await request('/api/bets', {
      method: 'POST',
      body: JSON.stringify(bet({ outcome, profit: 999 }))
    });

    assert.equal(response.status, 201);
    assert.equal(body.odds, 1.975);
    assert.equal(body.profit, expectedProfit);
    assert.equal(body.outcome, outcome);
  }
});

test('supports reading, updating, and deleting bets', async () => {
  const listBefore = await request('/api/bets');
  assert.equal(listBefore.response.status, 200);
  assert.equal(listBefore.body.length, 6);

  const target = listBefore.body[0];
  const updated = await request(`/api/bets/${target.id}`, {
    method: 'PUT',
    body: JSON.stringify(bet({ outcome: 'win', stake: 20 }))
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.profit, 19.5);

  const readBack = await request(`/api/bets/${target.id}`);
  assert.equal(readBack.body.outcome, 'win');

  const removed = await request(`/api/bets/${target.id}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 204);

  const missing = await request(`/api/bets/${target.id}`);
  assert.equal(missing.response.status, 404);
});
