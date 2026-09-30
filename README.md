# ARIA
Ask, Retrive, Interupted, Augment

A financial research and explanation assistant (research-only) built for an
AI & Agentic Systems hackathon. See [AGENTS.md](AGENTS.md) for the project
rules every contributor must follow.

## Layout

```
ARIA/
  backend/            Django + DRF API (settings package: ARIA)
    manage.py
    ARIA/             settings, urls, wsgi
    api/              DRF endpoints, models, Pydantic schemas
    agent/            agent orchestration (LLM + tools wiring)
    rag/              retrieval-augmented generation over the corpus
    evals/            evaluation suite (20+ questions)
  frontend/           Vite + React UI
  docker-compose.yml  MySQL + API + frontend
```

## Quick start (Docker)

Prerequisites: Docker Desktop (or any Docker with Compose v2+).

```bash
cp .env.example .env          # then edit secrets
docker compose up --build     # starts MySQL 8.4 + API + frontend
```

| URL | What |
|---|---|
| http://localhost:3000 | Frontend (dev server, hot reload) |
| http://localhost:8000/ | API metadata |
| http://localhost:8000/api/health/ | Liveness + DB probe (used by healthchecks) |
| http://localhost:8000/api/ask/ | `POST {"question": "..."}` → validated agent response |

`docker compose up` automatically applies migrations and starts the servers.
In development (the default, via `docker-compose.override.yml`) the backend
runs `runserver` and the repo is bind-mounted so code edits hot-reload; the
frontend is served by Vite with the same. For a production-like run:

```bash
docker compose -f docker-compose.yml up --build
```

### Running backend checks and tests

```bash
docker compose exec web python manage.py check
docker compose exec web python manage.py test        # uses test_aria DB; grants are automatic
docker compose exec web python manage.py makemigrations   # after model changes
```

### Environment variables

All configuration is environment-driven (no hardcoded secrets — AGENTS.md §6/12).
See [.env.example](.env.example) (backend: Django, MySQL, ports, CORS, LLM
model name and per-query token cap, data dir) and
[frontend/.env.example](frontend/.env.example) (API base URL).

### Data layout

MySQL data lives in the named volume `mysql-data`. First-time database
creation and test-DB grants happen automatically via
[docker/mysql-init/01-test-grants.sh](docker/mysql-init/01-test-grants.sh).
