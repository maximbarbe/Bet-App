const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createBet, deleteBet, getBet, listBets, updateBet } = require('./database');

const PORT = Number(process.env.PORT) || 4173;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body == null ? '' : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

// Validate at the API boundary and calculate profit on the server.
function validate(input) {
  const allowed = ['pending','win','loss','push','half-win','half-loss'];
  const required = ['date','sport','teamA','teamB','selection','line'];
  if (required.some(key => !String(input[key] || '').trim())) throw new Error('All bet fields are required');
  if (!Number.isFinite(Number(input.odds)) || Number(input.odds) < 1) throw new Error('Odds must be at least 1.00');
  if (!Number.isFinite(Number(input.stake)) || Number(input.stake) <= 0) throw new Error('Stake must be greater than zero');
  if (!allowed.includes(input.outcome || 'pending')) throw new Error('Invalid result');
  const outcome = input.outcome || 'pending';
  const odds = Number(input.odds), stake = Number(input.stake);
  const profits = { pending: null, win: stake * (odds - 1), loss: -stake, push: 0, 'half-win': stake * (odds - 1) / 2, 'half-loss': -stake / 2 };
  return { ...input, outcome, profit: profits[outcome] };
}

async function handleApi(req, res, pathname) {
  const match = pathname.match(/^\/api\/bets(?:\/(\d+))?$/);
  if (!match) return false;
  const id = match[1] ? Number(match[1]) : null;
  try {
    if (req.method === 'GET' && !id) return json(res, 200, listBets());
    if (req.method === 'GET' && id) {
      const bet = getBet(id);
      return json(res, bet ? 200 : 404, bet || { error: 'Bet not found' });
    }
    if (req.method === 'POST' && !id) {
      const b = validate(await readJson(req));
      return json(res, 201, createBet(b));
    }
    if (req.method === 'PUT' && id) {
      const b = validate(await readJson(req));
      const updated = updateBet(id, b);
      return json(res, updated ? 200 : 404, updated || { error: 'Bet not found' });
    }
    if (req.method === 'DELETE' && id) {
      return deleteBet(id) ? json(res, 204, null) : json(res, 404, { error: 'Bet not found' });
    }
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) { return json(res, 400, { error: error.message }); }
}

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url.pathname);
    if (!handled && !res.headersSent) json(res, 404, { error: 'API route not found' });
    return;
  }
  // Serve frontend files only from public/ to keep backend files private.
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(PUBLIC_DIR, requested);
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`Edge is running at http://127.0.0.1:${PORT}`));
