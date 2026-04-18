# personal-finance-tracker

Containerized, web-based personal finance tracker with a Java Spring Boot
backend and a Vite + React + Tailwind frontend, backed by SQLite with a
persistent Docker volume.

## Status

Step 2 of 5: project scaffolding. The SQLite schema (Step 1) and the
backend/frontend skeletons are in place. The Month Initialization logic,
dashboards, locking, and EMI projection arrive in later steps.

## Stack

- **Backend** — Spring Boot 3.3 (Java 21), Spring Data JPA, Flyway, SQLite JDBC
- **Frontend** — Vite + React 18 + TypeScript + Tailwind CSS
- **DB** — SQLite, migrated by Flyway, persisted via a Docker named volume
- **Orchestration** — `docker-compose.yml` (backend + frontend + nginx)

## Quick start

```bash
docker compose up --build
```

Then open:

- Frontend:         http://localhost:5173
- Backend ping:     http://localhost:8080/api/ping
- Backend health:   http://localhost:8080/actuator/health

The frontend renders a status card that calls `/api/ping`, which returns the
seeded currencies and budget categories — end-to-end confirmation that the
stack is wired up and Flyway migrations ran against the volume-backed SQLite.

## Repository layout

```
backend/
  pom.xml
  Dockerfile
  src/main/java/com/pft/          # PftApplication, config, web
  src/main/resources/
    application.yml
    db/migration/                  # V1__init.sql, V2__seed_reference_data.sql
frontend/
  package.json  vite.config.ts  tailwind.config.js  postcss.config.js
  index.html  nginx.conf  Dockerfile
  src/                             # main.tsx, App.tsx, index.css
docs/
  schema.md                        # ERD + design notes
docker-compose.yml
.env.example
```

## Development (without Docker)

Backend:

```bash
cd backend
./mvnw spring-boot:run            # or: mvn spring-boot:run
```

(The first run creates `./pft.db` — override with `PFT_DB_URL` if desired.)

Frontend:

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173, proxies /api -> :8080
```

## Persistent data

The Docker volume `pft-data` holds the SQLite database file at `/data/pft.db`
inside the backend container. Back up with:

```bash
docker run --rm -v pft-data:/d -v "$PWD":/out alpine \
  tar -C /d -czf /out/pft-backup-$(date +%F).tgz .
```
