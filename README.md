# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

> **Status: Phase 1 — Project setup.** Frontend and backend scaffolds are wired
> together. Database, authentication, and the matching engine are not built
> yet — they arrive in later phases. This README will be expanded into a full
> project write-up (architecture, matching algorithm, API reference, setup,
> testing, deployment, limitations) as those phases are completed.

## What is this project?

BloodConnect helps a **recipient** (someone who needs blood) find a suitable
**donor** quickly, based on blood-group compatibility, availability,
location, and request urgency. It is a discovery-and-coordination tool —
**final blood compatibility and donor eligibility must always be verified by
qualified medical professionals / blood banks.** This app does not make
clinical decisions.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (Neon) via Prisma ORM — *not set up yet*
- **Auth:** JWT + bcrypt — *not set up yet*
- **Testing:** Node's built-in test runner
- **Deployment (planned):** Vercel (frontend), Render (backend), Neon (DB)

## Project structure

```
bloodconnect-donor-matching/
├── frontend/   React app (Vite + Tailwind + React Router)
├── backend/    Express API server
│   └── src/
│       ├── controllers/   (empty for now)
│       ├── routes/        (empty for now)
│       ├── services/      (empty for now — matching engine goes here later)
│       ├── middleware/    (empty for now)
│       ├── utils/         (empty for now)
│       ├── tests/         (empty for now)
│       ├── app.js         Express app + middleware + routes
│       └── server.js      starts the HTTP server
└── README.md
```

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:5000`. Health check:
`curl http://localhost:5000/api/health`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173` and shows a live "Backend status"
message fetched from the backend's `/api/health` endpoint.

## Limitations (current phase)

- No database yet — nothing is persisted.
- No authentication yet.
- No matching engine yet.

These are addressed in later phases.
