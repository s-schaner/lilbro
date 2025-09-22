# VolleySense

VolleySense is a volleyball analytics trainer that ships with a mocked ingest pipeline and LLM-assisted insights. This repo
contains a FastAPI backend, a Vite + React frontend, and Docker tooling to run everything locally.

## Project layout

```
backend/        # FastAPI app and tests
web/            # Vite + React client
docker/         # Runtime Dockerfiles
```

## Getting started

1. Install the dependencies for both the API and the web client (see commands below).
2. Copy the sample environment file and adjust provider URLs as needed.
3. Run `docker-compose up --build` to start the stack (API on port 8000, web on port 5173).

The backend exposes mocked routes for analysis, events, stats, exports, trainer proposals, ingest progress, ScreenSnap
annotations, and LLM insights. The frontend renders the multi-panel console experience with module guards, error boundaries,
and feature flags.

Testing is available via `pytest` for the API and `npm run test` (Vitest) for the web client.
