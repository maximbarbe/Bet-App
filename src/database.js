const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new DatabaseSync(path.join(dataDirectory, 'edge.db'));

// WAL mode keeps reads responsive while a bet is being written.
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    sport TEXT NOT NULL,
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    selection TEXT NOT NULL,
    line TEXT NOT NULL,
    odds REAL NOT NULL CHECK (odds >= 1),
    stake REAL NOT NULL CHECK (stake > 0),
    outcome TEXT NOT NULL DEFAULT 'pending'
      CHECK (outcome IN ('pending','win','loss','push','half-win','half-loss')),
    profit REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const columns = `id, date, sport, team_a AS teamA, team_b AS teamB,
  selection, line, odds, stake, outcome, profit,
  created_at AS createdAt, updated_at AS updatedAt`;

const statements = {
  all: db.prepare(`SELECT ${columns} FROM bets ORDER BY datetime(date) DESC, id DESC`),
  one: db.prepare(`SELECT ${columns} FROM bets WHERE id = ?`),
  insert: db.prepare(`INSERT INTO bets
    (date, sport, team_a, team_b, selection, line, odds, stake, outcome, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`UPDATE bets SET date=?, sport=?, team_a=?, team_b=?,
    selection=?, line=?, odds=?, stake=?, outcome=?, profit=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`),
  remove: db.prepare('DELETE FROM bets WHERE id = ?')
};

function values(bet) {
  return [bet.date, bet.sport.trim(), bet.teamA.trim(), bet.teamB.trim(),
    bet.selection.trim(), bet.line.trim(), Number(bet.odds), Number(bet.stake),
    bet.outcome, bet.profit];
}

module.exports = {
  listBets: () => statements.all.all(),
  getBet: (id) => statements.one.get(id),
  createBet(bet) {
    const result = statements.insert.run(...values(bet));
    return statements.one.get(Number(result.lastInsertRowid));
  },
  updateBet(id, bet) {
    const result = statements.update.run(...values(bet), id);
    return result.changes ? statements.one.get(id) : null;
  },
  deleteBet: (id) => statements.remove.run(id).changes > 0
};
