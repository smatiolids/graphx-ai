# JanusGraph Visualizer Agent

Next.js app for selecting JanusGraph servers, creating sessions, sending natural-language prompts to an agent, generating Gremlin, executing queries, and visualizing results with React Flow.

## Stack

- Next.js (App Router) + TypeScript
- Radix UI primitives
- React Flow + Dagre
- `gremlin` for JanusGraph query execution
- `deepagents` (from `langchain-ai/deepagentsjs`) for agent reasoning/query generation
- YAML + JSON file-backed storage under `server/`

## Setup

1. Install `pnpm` (or use `corepack enable`).
2. Install dependencies:
   - `pnpm install`
3. Copy env file:
   - `cp .env.example .env.local`
4. Set `OPENAI_API_KEY` in `.env.local`.
5. (Optional) Set `LOG_LEVEL` in `.env.local` (`debug`, `info`, `warn`, `error`).
5. Start dev server:
   - `pnpm dev`

## API overview

- `GET/POST/PUT /api/servers`
- `PATCH/DELETE /api/servers/:id`
- `GET/POST /api/sessions`
- `GET/PATCH /api/sessions/:id`
- `POST /api/agent`
- `POST /api/query` (direct query execution for rerun/editor)

## Persistence

- Servers: `server/servers.yaml`
- Sessions: `server/sessions.json`
- Data model (optional for deep-agent tool): `server/datamodel.json` or `server/datamodel.yaml`

## Deep Agent Data Model Tool

- The deep agent is configured with a tool path using `readFile` and an injected file named `graph_datamodel.json`.
- Source priority for that model:
  1. `GRAPH_DATA_MODEL_JSON` env var (JSON string)
  2. `server/datamodel.json`
  3. `server/datamodel.yaml`
  4. Internal fallback model

## Logging

- Runtime logs are written as JSON lines to `log/app.log`.
- Configure verbosity with `LOG_LEVEL` (default `info`).
- Useful for debugging connection issues in `PUT /api/servers` and agent/query execution in `POST /api/agent`.
