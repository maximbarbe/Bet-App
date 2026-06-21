# Edge Bet Tracker

A dark, local-first bet tracking web app backed by SQLite. Track wagers, settle results with one click, review cumulative profit, and calculate Quarter Kelly stakes.

## Run locally

Start the Node server, then open `http://127.0.0.1:4173`:

```powershell
npm.cmd start
```

Bet data is stored in `data/edge.db`. The database persists across browser and computer restarts. Back up that file to back up the ledger.

## Run with Docker

Docker Compose builds the pinned Node.js image and stores SQLite data in a named volume:

```powershell
docker compose up --build -d
```

Open `http://127.0.0.1:4173`. View logs or stop the application with:

```powershell
docker compose logs -f edge
docker compose down
```

`docker compose down` preserves the `edge-bet-tracker-data` volume. Running `docker compose down -v` permanently deletes the container database.

The container runs as a non-root user with a read-only filesystem. Only `/app/data` is writable for SQLite.

## Deploy

The app includes a Node API and requires a host with persistent disk storage. It can be deployed to a Node host; for a multi-user version, the same API can later move to hosted PostgreSQL with authentication.

## Project structure

```text
public/              Browser application
  css/styles.css     Visual design and responsive layout
  js/app.js          Page rendering and interactions
  js/api.js          Database API client
  js/calculations.js Settlement, devig, and staking math
  js/utils.js        Formatting and DOM helpers
src/
  server.js          HTTP API and static file server
  database.js        SQLite schema and queries
data/edge.db         Local database (created at runtime)
Dockerfile           Reproducible production image
compose.yml          Local container and persistent volume
```
