# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

> **Status: Phase 2 — Database design.** Frontend/backend scaffolds are wired
> together, and the PostgreSQL schema (User, DonorProfile, BloodRequest,
> DonorMatch, Notification) is defined and migrated via Prisma. Authentication
> and the matching engine are not built yet — they arrive in later phases.
> This README will be expanded into a full project write-up (architecture,
> matching algorithm, API reference, setup, testing, deployment, limitations)
> as those phases are completed.

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
- **Database:** PostgreSQL (Neon in production; local Postgres in dev) via Prisma ORM
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
│       ├── utils/
│       │   └── prisma.js  shared PrismaClient instance
│       ├── tests/         (empty for now)
│       ├── app.js         Express app + middleware + routes
│       └── server.js      starts the HTTP server
│   └── prisma/
│       ├── schema.prisma  database schema (5 models + enums)
│       └── migrations/    versioned SQL migration history
└── README.md
```

## Database schema

```
User
  ├──1:1──> DonorProfile        (created if/when the user registers as a donor)
  ├──1:many──> BloodRequest     (requests this user created, as a recipient)
  └──1:many──> Notification     (in-app notifications sent to this user)

BloodRequest
  └──1:many──> DonorMatch       (candidate donors ranked for this request)

DonorProfile
  └──1:many──> DonorMatch       (requests this donor was matched against)
```

- **Enums** (fixed, DB-enforced value sets): `BloodGroup` (A_POS...O_NEG),
  `Urgency` (NORMAL/URGENT/EMERGENCY), `RequestStatus` (the request state
  machine, see Phase 8), `MatchStatus` (PENDING/ACCEPTED/DECLINED).
- A user is *not* tagged with a fixed "donor" or "recipient" role — they
  become a donor the moment a `DonorProfile` row exists for them, and can
  independently create `BloodRequest`s. This avoids an artificial
  restriction (a donor should still be able to request blood for someone
  else).
- `DonorProfile.userId` is `@unique`, which is what makes User↔DonorProfile
  one-to-one instead of one-to-many.
- `DonorMatch` is a join table between `BloodRequest` and `DonorProfile`
  carrying its own data (`score`, `status`); a unique constraint on
  `(requestId, donorProfileId)` stops duplicate matches.

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL — see below
npx prisma migrate dev # creates tables from prisma/schema.prisma
npm run dev
```

You need a running PostgreSQL instance and a `DATABASE_URL` in `.env`:
- **Local Postgres:** `postgresql://postgres:postgres@localhost:5432/bloodconnect`
  (create the DB first: `createdb bloodconnect`)
- **Neon (production):** copy the connection string from your Neon project
  dashboard — it already includes `?sslmode=require`.

Backend runs at `http://localhost:5000`. Health check (also pings the DB):
`curl http://localhost:5000/api/health` →
`{"message":"BloodConnect backend is running","database":"connected"}`

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

- No authentication yet — anyone with API access can act as any user (fixed
  in Phase 3).
- No matching engine yet.
- No API routes exposed for the models yet — the schema exists and is
  migrated, but there's no way to create a User/Request via HTTP yet.

These are addressed in later phases.
