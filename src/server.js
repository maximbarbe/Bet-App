const path = require('node:path');
const express = require('express');
const { createBet, deleteBet, getBet, listBets, updateBet } = require('./database');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const OUTCOMES = new Set(['pending', 'win', 'loss', 'push', 'half-win', 'half-loss']);

function profitFor(outcome, odds, stake) {
  const profits = {
    pending: null,
    win: stake * (odds - 1),
    loss: -stake,
    push: 0,
    'half-win': stake * (odds - 1) / 2,
    'half-loss': -stake / 2
  };
  return profits[outcome];
}

// Validate at the API boundary so the database only receives clean, calculated bets.
function validateBet(input) {
  const required = ['date', 'sport', 'teamA', 'teamB', 'selection', 'line'];
  if (required.some(key => !String(input[key] || '').trim())) {
    throw new Error('All bet fields are required');
  }

  const odds = Number(input.odds);
  const stake = Number(input.stake);
  const outcome = input.outcome || 'pending';

  if (!Number.isFinite(odds) || odds < 1) throw new Error('Odds must be at least 1.00');
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be greater than zero');
  if (!OUTCOMES.has(outcome)) throw new Error('Invalid result');

  return { ...input, odds, stake, outcome, profit: profitFor(outcome, odds, stake) };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function readId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/bets', (req, res) => {
    res.set('Cache-Control', 'no-store').json(listBets());
  });

  app.post('/api/bets', asyncRoute(async (req, res) => {
    res.status(201).json(createBet(validateBet(req.body || {})));
  }));

  app.get('/api/bets/:id', (req, res) => {
    const id = readId(req);
    const bet = id ? getBet(id) : null;
    res.status(bet ? 200 : 404).json(bet || { error: 'Bet not found' });
  });

  app.put('/api/bets/:id', asyncRoute(async (req, res) => {
    const id = readId(req);
    const updated = id ? updateBet(id, validateBet(req.body || {})) : null;
    res.status(updated ? 200 : 404).json(updated || { error: 'Bet not found' });
  }));

  app.delete('/api/bets/:id', (req, res) => {
    const id = readId(req);
    if (id && deleteBet(id)) return res.status(204).end();
    return res.status(404).json({ error: 'Bet not found' });
  });

  app.all('/api/bets', (req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

  app.all('/api/bets/:id', (req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  // Express serves only public assets; source and database files stay private.
  app.use(express.static(PUBLIC_DIR, { index: false }));

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const isInvalidJson = error.type === 'entity.parse.failed';
    const status = isInvalidJson || error.message ? 400 : 500;
    return res.status(status).json({ error: isInvalidJson ? 'Invalid JSON' : error.message });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, HOST, () => {
    console.log(`Edge is running at http://${HOST}:${PORT}`);
  });
}

module.exports = { createApp, validateBet };
