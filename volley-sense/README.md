# VolleySense

VolleySense delivers a demo-ready slice of an auto-stat volleyball analytics platform. It includes a React + TypeScript dashboard with an event trainer workflow and a FastAPI backend that serves deterministic mock data. Docker tooling and cross-platform installers wire everything together for a one-command setup on Linux or Windows.

## Features

- **Interactive dashboard** with event trainer, video mock, timeline markers, right-side insights, and export buttons.
- **Trainer workflow** featuring enable/disable toggles, confidence sliders, preview detections, explain popovers, and a modal to teach new events.
- **Mock backend** (FastAPI) exposing `/analyze`, `/events`, `/stats`, `/trainer/*`, `/explain`, and `/export/*` endpoints with seeded sample data.
- **Persistent definitions** stored in localStorage on the client and synced to the API when saved.
- **Exports** providing downloadable CSV, PDF, and ZIP placeholder files via streaming responses.
- **Strict TypeScript** configuration with ESLint, Prettier, Vitest unit tests, and snapshot coverage.
- **Docker Compose** workflow for running the web and API services together.

## Project structure

```
volley-sense/
  apps/
    web/            # React + Vite front end (TypeScript, Tailwind, Zustand)
    api/            # FastAPI mock backend with pytest suite
  docker/           # Production/dev Dockerfiles
  docker-compose.yml
  install.sh        # Linux/macOS installer
  install.ps1       # Windows installer
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Docker (for container workflow)
- Git (for development)

If you plan to use the installers, ensure you can elevate privileges to install missing dependencies.

## Quick start (manual)

1. **Backend**
   ```bash
   cd volley-sense/apps/api
   python -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -e .[dev]
   uvicorn app.main:app --reload
   ```
   API is now available at <http://localhost:8000/docs>.

2. **Frontend**
   ```bash
   cd volley-sense/apps/web
   npm install
   npm run dev
   ```
   Visit <http://localhost:5173> to view the dashboard.

3. **Docker Compose**
   ```bash
   cd volley-sense
   docker-compose up --build
   ```
   This launches both services with the web app proxied to the FastAPI container.

## Automated installers

### Linux / macOS (`install.sh`)

```bash
cd volley-sense
chmod +x install.sh
./install.sh
```

The script checks for Docker, Node.js, npm, Python, and pip, offering to install them via `apt-get` when available. It guides you through:

- Installing JavaScript dependencies (`npm install`).
- Creating a Python virtual environment and installing the FastAPI app (`pip install -e .[dev]`).
- Running optional unit tests.
- Optionally building the production bundle and/or launching `docker-compose up --build`.
- Printing troubleshooting tips if dependencies are missing or services fail to start.

### Windows (`install.ps1`)

```powershell
cd volley-sense
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned # if required
./install.ps1
```

The PowerShell installer verifies Docker Desktop, Node.js, npm, and Python. It prompts you to install npm packages, create a virtual environment, run the automated test suites, and optionally launch Docker Compose. Each missing dependency includes download links and the script pauses until requirements are met.

## Running tests

- Frontend: `cd apps/web && npm run test -- --run`
- Backend: `cd apps/api && pytest`

Both suites are also available through the installers with the “Run automated tests” prompt.

## User guide

1. **Select match & live status** – Use the dropdown in the top bar to switch between seeded matches. The live indicator reflects an active feed.
2. **Event trainer panel** – Toggle events on/off, adjust confidence thresholds, or click **Preview** to fetch mock detections (purple timeline markers). **Rules** opens an inline explanation card from the `/explain` API, and **Clips** queues highlight notifications.
3. **Teach new event** – Click **Teach New Event** to open the modal. Choose a template, supply a name, and set the threshold. On save the definition is persisted locally and synced to the backend; a snackbar confirms the shadow test.
4. **Video playback** – The central panel simulates match playback. Use the transport controls or keyboard focus to navigate. Toggle overlays via the **Overlays** pill.
5. **Timeline** – Hover markers for tooltips and click to jump the mocked playback time. Preview markers appear in purple when enabled events return detections.
6. **Right panel tabs** – Review player cards, chronological event feed (click **Play** to seek), or a formation map with alerts.
7. **Footer exports** – Download the mock PDF summary, player CSV, or highlight ZIP through streaming endpoints.

## Troubleshooting

- **API unreachable** – Ensure FastAPI is running (check terminal output) and that `VITE_API_URL` matches the backend host when running outside Docker.
- **Docker build fails** – Restart the Docker daemon, verify your user is in the `docker` group (`sudo usermod -aG docker $USER`), and rerun `docker-compose up --build`.
- **Node dependency conflicts** – Clear the cache (`npm cache clean --force`), delete `node_modules`, and reinstall.
- **Python import errors** – Activate the virtual environment (`source .venv/bin/activate`) or reinstall with `pip install -e .[dev]` inside `apps/api`.

## API reference

Visit <http://localhost:8000/docs> for the autogenerated Swagger UI. Key endpoints:

- `POST /analyze` – starts a mock analysis job.
- `GET /events?game_id=` – returns seeded timeline markers.
- `GET /stats?game_id=` – delivers player stats.
- `GET /trainer/events` – lists trainer definitions.
- `POST /trainer/events` – upserts a definition.
- `GET /trainer/preview?eventId=&game_id=` – generates preview detections.
- `GET /explain?event_id=` – returns feature/rule rationale.
- `GET /export/summary.pdf`, `/players.csv`, `/highlights.zip` – download artifacts.

Enjoy exploring VolleySense!
