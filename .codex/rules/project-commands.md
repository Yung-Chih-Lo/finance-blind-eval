# Project Commands

Hand-edited (auto-generation by `/opsxp-setup` not used; project is a monorepo with both Python and Node sub-projects).

## Test
```
# Backend (run from backend/, venv active)
.venv/bin/pytest

# Frontend (run from frontend/apps/web/)
npm test
```

## Lint
```
# Backend
.venv/bin/ruff check .

# Frontend
npm run lint  # if configured by turborepo
```

## Typecheck
```
# Backend
.venv/bin/mypy app

# Frontend
npm run typecheck
```

## Build
```
# Frontend
npm run build

# Backend has no build step (run via uvicorn)
```

## Stack
- Frontend: Vite + React + TypeScript + Tailwind (turborepo, in `frontend/`)
- Backend: FastAPI + httpx + Pydantic (in `backend/`)
- Storage / Auth: PocketBase (Zeabur, https://course-db.zeabur.app)

## Common dev commands
```
# Backend dev server
cd backend && .venv/bin/uvicorn app.main:app --reload

# Frontend dev server
cd frontend/apps/web && npm run dev

# PocketBase schema setup (run once)
cd backend && .venv/bin/python -m scripts.pb_setup

# Add a teacher account (run per teacher)
cd backend && .venv/bin/python -m scripts.add_teacher --email ... --password ... --name ...
```
