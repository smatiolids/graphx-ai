# Development Guide

## Stack

- Next.js (App Router) + TypeScript
- Radix UI primitives
- React Flow + Dagre
- `gremlin` for JanusGraph query execution
- `deepagents` + LangChain/OpenAI for query planning
- File-backed persistence under `server/` (YAML + JSON)

## Environment Variables

Required:
- `OPENAI_API_KEY`: OpenAI API key used by the Deep Agent.

Optional:
- `OPENAI_MODEL` (default `gpt-4.1-mini`)
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`)
- `GREMLIN_DEFAULT_TRAVERSAL_SOURCE` (default `g`)
- `GREMLIN_REJECT_MUTATIONS` (`true` by default; blocks mutating Gremlin in `/api/agent` and `/api/query`)
- `GRAPH_DATA_MODEL_JSON` (JSON string used as base data model)
- `JANUSGRAPH_SESSION_SAMPLE_SIZE` (default `1`; per-label sample count collected when creating sessions)

## API Overview

- `GET/POST/PUT /api/servers`
- `PATCH/DELETE /api/servers/:id`
- `GET/POST /api/sessions`
- `GET/PATCH/DELETE /api/sessions/:id`
- `POST /api/agent` (prompt -> generated query -> execution)
- `POST /api/query` (direct query execution / rerun)

## Deep Agent Flow

On each agent request:
1. Session query history is appended to the current prompt.
2. Agent must call `get_graph_context_summary`.
3. Agent returns JSON with `query` and `reasoning`.
4. Query is mutation-checked (if enabled), executed, normalized, and persisted to session messages.

The system prompt enforces:
- use `get_graph_context_summary` before query generation
- rely only on the returned graph context
- output JSON only (`query`, `reasoning`)
- read-only Gremlin over traversal source `g`

## Session Context Files

When a session is created, the app initializes session-specific context in `server/<session-id>/`:
- `graph_datamodel.json`
- `janusgraph_schema_indexes.json`

During agent usage, a compact summary is generated:
- `graph_context_summary.json`

Context initialization combines:
- base data model (`GRAPH_DATA_MODEL_JSON`, `server/datamodel.json`, or `server/datamodel.yaml`)
- live JanusGraph schema/index inspection
- per-label vertex/edge sampling

Legacy context files from `server/session-contexts/<session-id>/` are auto-migrated on first access.

## Persistence

- Servers: `server/servers.yaml`
- Sessions: `server/sessions.json`
- Base model (optional): `server/datamodel.json` or `server/datamodel.yaml`
- Per-session context: `server/<session-id>/...`

## Logging

- Runtime events: `log/app.log` (JSON lines)
- Prompt audit trail: `log/agent-prompts.log`
- Latest prompt/response snapshot per session: `log/<session-id>-last-prompt.md`
