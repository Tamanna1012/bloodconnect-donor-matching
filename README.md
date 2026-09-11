# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

> **Status: Phase 5 — Blood compatibility function.** Frontend/backend
> scaffolds are wired together, the PostgreSQL schema is migrated, users
> can register/log in, `BloodRequest` CRUD has ownership checks, and there's
> now a pure, deterministic `isCompatible()` function implementing the
> standard ABO/Rh transfusion rule (verified against all 64 donor/recipient
> combinations). The full donor-ranking matching engine, donor-side
> endpoints, and the formal request state machine are not built yet — they
> arrive in later phases. This README will be expanded into a full project
> write-up (architecture, matching algorithm, API reference, setup, testing,
> deployment, limitations) as those phases are completed.

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
- **Auth:** JWT + bcrypt
- **Testing:** Node's built-in test runner
- **Deployment (planned):** Vercel (frontend), Render (backend), Neon (DB)

## Project structure

```
bloodconnect-donor-matching/
├── frontend/   React app (Vite + Tailwind + React Router)
├── backend/    Express API server
│   └── src/
│       ├── controllers/
│       │   ├── authController.js         register/login/me request handlers
│       │   └── bloodRequestController.js create/list/get/update/cancel
│       ├── routes/
│       │   ├── authRoutes.js             POST /register, POST /login, GET /me
│       │   └── bloodRequestRoutes.js     /api/requests CRUD
│       ├── services/
│       │   ├── authService.js            auth business logic (bcrypt + JWT)
│       │   ├── bloodRequestService.js    CRUD + ownership enforcement
│       │   └── bloodCompatibility.js     isCompatible() — ABO/Rh screening rule
│       ├── middleware/
│       │   └── authMiddleware.js   requireAuth — protects routes via JWT
│       ├── utils/
│       │   ├── prisma.js           shared PrismaClient instance
│       │   ├── jwt.js              sign/verify JWT helpers
│       │   ├── validators.js       email/password/blood-group/urgency checks
│       │   └── httpErrors.js       assertFound / assertOwnership helpers
│       ├── tests/
│       │   ├── auth.service.test.js
│       │   ├── authMiddleware.test.js
│       │   ├── bloodRequest.service.test.js
│       │   └── bloodCompatibility.test.js
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

## Blood compatibility (`isCompatible`)

`backend/src/services/bloodCompatibility.js` exports one pure function:

```js
isCompatible(donorBloodGroup, recipientBloodGroup) // -> boolean
```

It implements the standard **ABO/Rh** red-cell transfusion compatibility
model — not an invented rule. The core idea: red blood cells carry
**antigens** (A, B, and Rh), and a transfusion is safe only when the
donor's antigens are a subset of the recipient's antigens (nothing "foreign"
for the recipient's immune system to attack):

- `O` carries no ABO antigens → **O can donate to anyone** (universal donor).
- `AB` carries both A and B antigens → an **AB recipient can receive from
  anyone** (universal recipient) — their body already recognizes A and B.
- `Rh-` carries no Rh antigen → **Rh- can donate to both Rh- and Rh+**;
  `Rh+` can only donate to `Rh+`.

That single "antigen subset" rule — implemented once for ABO and once for
Rh — reproduces the *entire* standard compatibility chart, instead of
hand-copying a 64-cell lookup table:

```
Donor   -> Compatible recipients
O-      -> O-, O+, A-, A+, B-, B+, AB-, AB+   (universal donor)
O+      -> O+, A+, B+, AB+
A-      -> A-, A+, AB-, AB+
A+      -> A+, AB+
B-      -> B-, B+, AB-, AB+
B+      -> B+, AB+
AB-     -> AB-, AB+
AB+     -> AB+                                 (most restrictive donor)
```

`backend/src/tests/bloodCompatibility.test.js` doesn't just spot-check a
few pairs — it checks **all 64 donor × recipient combinations** against a
hardcoded reference table matching the real medical chart, plus named
landmark cases (O- universal donor, AB+ universal recipient, etc).

**This is a software screening rule only** — it filters/ranks candidate
donors for the app's matching engine. It is never a substitute for the
actual cross-match and medical verification a blood bank performs before
any real transfusion.

## Authentication

- **Registration** (`POST /api/auth/register`) — validates input, checks the
  email isn't already taken, hashes the password with **bcrypt** (never
  stored in plain text), creates the `User` row, and returns a signed
  **JWT** + the user (password excluded).
- **Login** (`POST /api/auth/login`) — looks up the user by email, compares
  the submitted password against the stored hash with `bcrypt.compare`, and
  returns a new JWT on success. Wrong email and wrong password return the
  *same* error message on purpose, so the API doesn't leak which emails are
  registered.
- **Protected routes** — any route that adds the `requireAuth` middleware
  requires an `Authorization: Bearer <token>` header. The middleware
  verifies the token's signature, re-fetches the user from the database
  (so a deleted/changed user can't keep using an old token), and attaches
  it as `req.user` for the route handler to use. `GET /api/auth/me` is the
  first example of this.
- **Logout strategy** — JWTs are stateless, so "logout" simply means the
  frontend deletes the token it's holding (e.g. from `localStorage`). The
  server doesn't track sessions to invalidate. The trade-off: a stolen
  token stays valid until it expires (7 days) — a known JWT limitation,
  listed under Limitations below.
- **Authentication vs. authorization:** authentication answers *"who are
  you?"*. Authorization answers *"what are you allowed to do?"* — see below.

## Authorization (ownership checks)

Being logged in is not the same as being allowed to touch a specific piece
of data. `BloodRequest` is our first real example:

| Action | Endpoint | Who can do it |
|---|---|---|
| Create | `POST /api/requests` | Any logged-in user (becomes the owner) |
| List / view | `GET /api/requests`, `GET /api/requests/:id` | Any logged-in user — donors need to *browse* requests to be matched, so reads are intentionally open |
| Update | `PUT /api/requests/:id` | **Only the owner** |
| Cancel | `DELETE /api/requests/:id` | **Only the owner** |

The check itself lives in `bloodRequestService.js`, not in the route or
controller — `updateBloodRequest`/`cancelBloodRequest` load the request,
then call `assertOwnership(request.requesterId, requestingUserId, ...)`
(`utils/httpErrors.js`), which throws a `403 Forbidden` if the IDs don't
match. This is the fix for the classic **IDOR (Insecure Direct Object
Reference)** vulnerability: without this check, User B could edit or delete
User A's request just by changing the ID in the URL, since a valid JWT
alone proves nothing about *which resource* B should be touching.

`assertOwnership` is written generically (owner id vs. requesting-user id,
not tied to `BloodRequest` specifically) so the same one-liner can protect
`DonorProfile` or any future resource without copy-pasting the check.

I verified this against the real running server: registered two users,
had User A create a request, then confirmed User B gets `403` on `PUT` and
`DELETE` but `200` on `GET` (open browsing), while User A gets `200` on
all three. See `backend/src/tests/bloodRequest.service.test.js` for the
automated version of the same scenario.

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL and JWT_SECRET — see below
npx prisma migrate dev # creates tables from prisma/schema.prisma
npm run dev
```

You need a running PostgreSQL instance and a `DATABASE_URL` in `.env`:
- **Local Postgres:** `postgresql://postgres:postgres@localhost:5432/bloodconnect`
  (create the DB first: `createdb bloodconnect`)
- **Neon (production):** copy the connection string from your Neon project
  dashboard — it already includes `?sslmode=require`.

You also need a `JWT_SECRET` in `.env` — generate your own with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Never commit the real value or reuse it across environments.

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

## Testing

```bash
cd backend
npm test
```

Runs Node's built-in test runner (`node --test`) against
`backend/src/tests/*.test.js`. Most of these are integration tests — they
hit a real Postgres database through Prisma (using whatever `DATABASE_URL`
is in your `.env`), not a mock, and clean up the rows they create
afterward. `bloodCompatibility.test.js` is a pure unit test — no database
involved, since `isCompatible()` is a pure function. Current coverage (20
tests): registration success, duplicate-email rejection, login success,
wrong-password rejection, the auth middleware rejecting missing/invalid
tokens, blood-request CRUD, ownership rejection (a non-owner getting 403 on
update/cancel), and all 64 ABO/Rh compatibility combinations.

## Limitations (current phase)

- No matching engine yet — `BloodRequest`s exist but nothing finds/ranks
  donors for them yet.
- No donor-side or notification endpoints yet — only auth + blood-request
  endpoints exist so far.
- No formal request state machine yet — `DELETE` sets `status: CANCELLED`
  directly rather than going through a validated transition function; that
  comes in a later phase.
- Logout is client-side only (delete the token) — there's no server-side
  token blacklist, so a stolen token remains valid until it expires (7
  days). A production system might add a short-lived access token + refresh
  token pair; out of scope here to keep things explainable.

These are addressed in later phases.
