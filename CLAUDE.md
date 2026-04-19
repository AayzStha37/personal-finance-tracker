# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Containerized personal finance tracker with a Java Spring Boot backend and Vite + React + TypeScript + Tailwind frontend, using SQLite with Flyway migrations. Base reporting currency is CAD.

## Commands

### Full stack (Docker)
```bash
docker compose up --build
```
Frontend at http://localhost:5173, backend at http://localhost:8080.

### Backend (local dev)
```bash
cd backend
./mvnw spring-boot:run                    # creates ./pft.db locally
./mvnw test                               # run all tests
./mvnw test -Dtest=ApiIntegrationTest      # run single test class
```

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev          # dev server, proxies /api -> :8080
npm run build        # typecheck + production build
npm run lint         # typecheck only (tsc --noEmit)
```

## Architecture

### Backend (`backend/` — Spring Boot 3.3, Java 21)

- **Domain entities** (`com.pft.domain`): JPA entities mapping to SQLite tables. Money is stored as `INTEGER` minor units (cents) — never floats.
- **Repositories** (`com.pft.repository`): Spring Data JPA interfaces, one per entity.
- **Services** (`com.pft.service`): Business logic layer. `LockGuard` enforces month-locking across all mutating paths — any write to a LOCKED month throws `ConflictException`.
- **Controllers** (`com.pft.web`): REST controllers under `/api`. DTOs are Java records in a single `Dtos.java` file. Global exception handler in `GlobalExceptionHandler.java`.
- **Migrations** (`src/main/resources/db/migration/`): Flyway SQL migrations. `V1__init.sql` creates the schema; `V2__seed_reference_data.sql` seeds currencies and budget categories.

Key constraints:
- SQLite requires `hikari.maximum-pool-size: 1` (single-writer).
- `PRAGMA foreign_keys = ON` is set per connection via HikariCP `connection-init-sql`.
- Flyway is pinned to 9.22.3 (last version with built-in SQLite support).

### Frontend (`frontend/src/` — React 18, TypeScript, Tailwind)

- **API layer** (`api/client.ts`, `api/types.ts`): Typed fetch wrapper calling `/api` endpoints. All DTO types mirror the backend.
- **State** (`state/AppContext.tsx`): React context for shared app state.
- **Pages** (`pages/`): Route-level components — Dashboard, Months, MonthDetail, Accounts, Investments, EMI, FX.
- **Features** (`features/newMonth/`): New Month wizard with integrity panel (validates opening vs. previous closing balances).
- **Shared UI** (`components/ui.tsx`): Reusable UI primitives. `Layout.tsx` is the app shell.
- **Money utils** (`lib/money.ts`): Formatting helpers that convert minor-unit integers using currency decimal info.

### Month Lifecycle

`DRAFT -> ACTIVE -> LOCKED`. Months progress through this lifecycle: DRAFT during wizard setup, ACTIVE for daily use, LOCKED for read-only archival. `LockGuard` on the backend enforces immutability of LOCKED months.

### EMI Projection

Creating an EMI plan pre-materializes N installment rows (status `PROJECTED`). On month initialization, projected installments become expense entries (status `PAID`).

### Tests

Integration tests use `@SpringBootTest` with `MockMvc` against a temp SQLite file (via `@DynamicPropertySource`). The test suite covers month lifecycle, lock enforcement, EMI projection, and expense/income CRUD in a single sequential workflow test.

### FX Rates

Exchange rates are fetched from `open.er-api.com` (free, no API key). Rates can be `AUTO` (fetched) or `MANUAL` (user override). Config in `application.yml` under `pft.fx`.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
