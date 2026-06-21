# Edge Bet Tracker

A dark, local-first bet tracking web app backed by SQLite. Track wagers, settle results with one click, review cumulative profit, and calculate Quarter Kelly stakes.

## Run locally

Start the Node server, then open `http://127.0.0.1:4173`:

```powershell
npm.cmd start
```

Bet data is stored in `data/edge.db`. The database persists across browser and computer restarts. Back up that file to back up the ledger.

## Deploy

The app includes a Node API and requires a host with persistent disk storage. It can be deployed to a Node host; for a multi-user version, the same API can later move to hosted PostgreSQL with authentication.
