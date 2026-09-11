# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

> **Status: Phase 8 — Request state machine.** Frontend/backend scaffolds
> are wired together, the PostgreSQL schema is migrated, users can
> register/log in, `BloodRequest` CRUD has ownership checks, the core
> donor matching/ranking engine exists and is verified against real
> Postgres data, and `BloodRequest.status` now moves only through a
> validated set of transitions (`OPEN → MATCHING → DONOR_CONTACTED →
> ACCEPTED → FULFILLED`, with `CANCELLED` reachable from most states, and
> `FULFILLED`/`CANCELLED` as terminal states) instead of being freely
> overwritable. Donor-facing API endpoints and notifications are not built
> yet — they arrive in later phases. This README will be expanded into a
> full project write-up (architecture, matching algorithm, API reference,
> setup, testing, deployment, limitations) as those phases are completed.

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
│       │   ├── bloodCompatibility.js     isCompatible() — ABO/Rh screening rule
│       │   ├── proximity.js              Haversine distance + proximity score
│       │   ├── donorReliability.js       reliability score from donor history
│       │   ├── bloodMatchingEngine.js    hard filters + ranking (the core feature)
│       │   └── requestStateMachine.js    valid BloodRequest.status transitions
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
│       │   ├── proximity.test.js
│       │   ├── donorReliability.test.js
│       │   ├── requestStateMachine.test.js
│       │   ├── bloodRequestStateMachine.service.test.js
│       │   ├── bloodMatchingEngine.test.js
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

## Donor matching & ranking engine (the core feature)

`backend/src/services/bloodMatchingEngine.js` is the most important file in
this project. Given a `BloodRequest` and a list of candidate
`DonorProfile`s, `rankDonorsForRequest(request, donorProfiles)` returns
only the eligible donors, sorted best-match-first. No AI/LLM is involved —
every number it produces is explainable in one sentence.

**The algorithm has two distinct phases, and keeping them separate matters:**

1. **Hard filters** (`isEligibleDonor`) — binary, non-negotiable gates. A
   donor is excluded entirely, not just penalized, if either fails:
   - **Blood-group compatibility** — `isCompatible(donor.bloodGroup, request.bloodGroup)`
   - **Availability** — `donor.isAvailable === true`

   A high score from being nearby must never be able to "outweigh" being
   medically incompatible — that's why these are filters, not scored
   inputs.

2. **Ranking score** (`scoreDonor`) — among donors who passed both hard
   filters, three factors combine into a `totalScore` (0–100):

   | Component | Range | Source |
   |---|---|---|
   | Proximity | 0–40 | `proximity.js` — Haversine distance in km, bucketed (≤5km→40 ... >100km→0); falls back to same-city (25) vs different-city (5) when coordinates aren't available |
   | Urgency | 0–30 | `NORMAL`→0, `URGENT`→15, `EMERGENCY`→30 |
   | Reliability | 0–30 | `donorReliability.js` — see below |

   The list is then sorted by `totalScore`, descending.

**Donor reliability** (`donorReliability.js`) is a simple, rule-based
metric over counters already on `DonorProfile` (`requestsReceived`,
`requestsAccepted`, `donationsCompleted`) — no machine learning:

```
acceptanceRate = requestsAccepted / requestsReceived   (0.5 if the donor has no history yet)
reliabilityScore = round(acceptanceRate × 20 + min(donationsCompleted, 5) × 2)
```

A brand-new donor gets a neutral score instead of zero (so being new isn't
punished), and the completed-donations bonus is capped so a very long
history can't unfairly dominate the score.

**Privacy note:** a donor's exact latitude/longitude is used only inside
`calculateProximityScore`'s internal Haversine calculation — it is never
returned in any API response. Only the resulting *score* leaves this
function, so a donor's precise location is never exposed publicly.

**On the request lifecycle:** `validateRequestForMatching` refuses to
match a `FULFILLED` or `CANCELLED` request — matching only makes sense
while a request is still `OPEN` or `MATCHING`. This is a preview of the
formal state machine built in a later phase.

I verified the full engine against real Postgres data (not just hand-built
test objects): seeded 5 donors with different blood groups, cities,
coordinates, and reliability histories against a real `EMERGENCY A_POS`
request, fetched everything back through Prisma, and ran the actual
`rankDonorsForRequest`. Result:

```
Request: A_POS x2, EMERGENCY, Chennai

Ranked eligible donors (highest score first):
  Nearby Reliable O-neg        total=98 (proximity=40, urgency=30, reliability=28)
  Nearby Unreliable A-pos      total=72 (proximity=40, urgency=30, reliability=2)
  Far Reliable O-neg           total=58 (proximity=0,  urgency=30, reliability=28)

(2 of 5 donors were excluded by hard filters: incompatible blood group or unavailable)
```

The B+ donor (incompatible) and the unavailable A- donor were correctly
excluded before scoring even started; among the 3 eligible donors, distance
and reliability both visibly move the ranking exactly as designed.

## Request state machine

`BloodRequest.status` doesn't move freely between any two values — it
follows a fixed set of legal transitions, defined once in
`backend/src/services/requestStateMachine.js`:

```
OPEN            → MATCHING, CANCELLED
MATCHING        → DONOR_CONTACTED, CANCELLED
DONOR_CONTACTED → ACCEPTED, MATCHING, CANCELLED    (donor declines -> back to searching)
ACCEPTED        → FULFILLED, MATCHING, CANCELLED   (accepted donor backs out -> back to searching)
FULFILLED       → (terminal — nothing)
CANCELLED       → (terminal — nothing)
```

`FULFILLED` and `CANCELLED` are terminal: once a donation is complete or a
recipient cancels, that's final. `isValidTransition(from, to)` checks the
table; `assertValidTransition(from, to)` throws a `400` if the move isn't
listed. `PUT /api/requests/:id/status` is the only way to change status —
`transitionBloodRequestStatus()` calls `assertValidTransition` before
writing anything.

**Why a dedicated function instead of just checking status inline
wherever it's needed?** Because a business rule like "a fulfilled request
can never be reopened" is an invariant that must hold everywhere the data
can be touched — a background job, an admin tool, a future feature — not
just in the one route a developer remembers to guard. Centralizing it
means every caller automatically gets the same guarantee.

**A real bug this phase fixed:** before this phase, `PUT /api/requests/:id`
accepted a `status` field in the body and wrote it straight to the
database with zero validation — `{"status": "FULFILLED"}` would have
silently "completed" a request that was still sitting at `OPEN` with no
donor ever contacted. `updateBloodRequest` now explicitly rejects any
`status` field with a `400`, and `cancelBloodRequest` (the `DELETE`
endpoint) is rewritten to go through `transitionBloodRequestStatus`, so
cancelling an already-`FULFILLED` request is correctly rejected instead of
silently "succeeding."

I verified this live against the running server, replicating the spec's
own example exactly: walked a real request through the full happy path
(`OPEN → MATCHING → DONOR_CONTACTED → ACCEPTED → FULFILLED`, each a `200`),
then confirmed `FULFILLED → OPEN` is rejected with `400` — and confirmed
`DELETE` on that same now-`FULFILLED` request is also correctly rejected,
proving the bug above is actually fixed, not just theoretically fixed.

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
| Update (fields) | `PUT /api/requests/:id` | **Only the owner** (cannot change `status` — see state machine below) |
| Update (status) | `PUT /api/requests/:id/status` | **Only the owner**, and only to a valid next state |
| Cancel | `DELETE /api/requests/:id` | **Only the owner**, and only if the current status allows a transition to `CANCELLED` |

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
`backend/src/tests/*.test.js`. Auth and blood-request tests are
integration tests — they hit a real Postgres database through Prisma
(using whatever `DATABASE_URL` is in your `.env`), not a mock, and clean
up the rows they create afterward. `bloodCompatibility.test.js`,
`proximity.test.js`, `donorReliability.test.js`,
`bloodMatchingEngine.test.js`, and `requestStateMachine.test.js` are pure
unit tests — no database involved. Current coverage (54 tests) includes:
registration/login/duplicate-email/wrong-password, auth-middleware
rejection, blood-request CRUD + ownership rejection, all 64 ABO/Rh
compatibility combinations, Haversine distance correctness and proximity
score buckets, reliability scoring, the matching engine (hard filters +
ranking by distance/urgency/reliability), and the request state machine
(every valid transition, the `FULFILLED → OPEN` rejection, skipped-step
rejection, non-owner rejection, and cancelling an already-`FULFILLED`
request being correctly rejected).

## Limitations (current phase)

- No donor-side or notification endpoints yet — the matching engine
  (`bloodMatchingEngine.js`) is fully built and tested, but there's no
  `GET /api/requests/:id/matches` HTTP endpoint yet, and no way to create
  a `DonorProfile` via the API — those need the REST API phase.
- Nothing calls `transitionBloodRequestStatus` automatically yet — moving
  a request through `MATCHING`/`DONOR_CONTACTED`/`ACCEPTED` today requires
  calling `PUT /:id/status` directly. Once donor-match accept/decline
  endpoints exist, they'll trigger these transitions as a side effect.
- Matching results (`DonorMatch` rows) aren't persisted yet — the engine
  returns a ranked in-memory list; saving that as `DonorMatch` rows and
  triggering notifications happens once the API layer around it exists.
- All status transitions are currently owner-only, same as other
  blood-request writes. Realistically, some transitions (e.g. a donor
  accepting) should be donor-initiated, not recipient-initiated — that
  refinement lands once donor-facing endpoints and authorization exist.
- Logout is client-side only (delete the token) — there's no server-side
  token blacklist, so a stolen token remains valid until it expires (7
  days). A production system might add a short-lived access token + refresh
  token pair; out of scope here to keep things explainable.

These are addressed in later phases.
