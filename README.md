# Librify

Monorepo with a Node.js API (`server/`) and a frontend placeholder (`web/`).

## Prerequisites

- Node.js 18+
- A MongoDB connection string available locally (do not commit it)

## Setup

1. Clone this repository.
2. Copy `server/.env.example` to `server/.env` and fill in the values on your machine.
3. Install and start the API:

```bash
cd server
npm install
npm run dev
```

Production-style start (no nodemon):

```bash
cd server
npm start
```

The API listens on `PORT` from `server/.env` (defaults to `3001` if unset). Check it with:

```bash
curl http://localhost:3001/health
```

Expected JSON: `{ "status": "ok", "db": "ok" }` when MongoDB is connected, or `"db": "error"` if the database is not reachable.

## Environment variables (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string. The process exits if this is missing. |
| `PORT` | no | HTTP port (default `3001`). |
| `NODE_ENV` | no | Runtime environment (`development`, `production`, etc.). |

Never commit `server/.env`. Only `server/.env.example` (names and empty placeholders) is versioned.

## Layout

- `server/` — Express + Mongoose API
- `web/` — frontend (Next.js in a later stage)
