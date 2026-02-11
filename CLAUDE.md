# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Backend (runs on port 3001)
cd server && npm install && npm run dev

# Frontend (runs on port 3000)
cd client && npm install && npm run dev

# Database setup
createdb pickleball
psql -d pickleball -f database/schema.sql

# Seed data (creates admin user + sample data)
cd server && npm run seed

# Production build
cd client && npm run build
```

No test framework or linter is configured.

## Environment Variables (server/.env)

```
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/pickleball
JWT_SECRET=<secret>
```

## Architecture

Full-stack pickleball group play planning app with JWT auth, admin approval workflow for new members, group-based event system with first-come-first-served reservations. Deployed to Railway.app.

- **server/src/index.js** — Express entry point; mounts all middleware (helmet, CORS, rate limiting) and routes
- **server/src/config/db.js** — PostgreSQL pool with auto-initialization; falls back to SQLite via `db-sqlite.js`
- **server/src/middleware/** — `auth.js` (JWT verification), `adminOnly.js` (role check)
- **server/src/models/** — Direct SQL query functions (User, Group, Location, Event, Reservation) — no ORM
- **server/src/routes/** — REST endpoints: auth, users, groups, locations, events, reservations
- **client/src/context/AuthContext.jsx** — Global auth state, token management, login/logout
- **client/src/services/api.js** — Axios instance with JWT interceptor
- **client/src/pages/admin/** — Admin dashboard, user approval, group/location/event management
- **database/schema.sql** — Tables: users, groups, user_groups, locations, events, reservations

### Key Patterns

- Monorepo with `client/` (React 18 + Vite) and `server/` (Express + Node.js)
- JWT stored in localStorage, sent via Axios interceptor
- Models are plain functions running raw SQL against `pg` pool (no ORM)
- Routes use Express Router with auth middleware
- Server serves built client static files in production from `client/dist`
- Procfile: `web: cd server && npm start`
