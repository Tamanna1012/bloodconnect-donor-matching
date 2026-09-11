# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

A full-stack web application that helps a **recipient** (someone who needs
blood) find a suitable **donor** quickly — matched by blood-group
compatibility, availability, location, and urgency, then ranked by a
deterministic scoring algorithm. Built as a final-year B.Tech CSE project,
deliberately using a small, explainable tech stack: the engineering depth
is in the logic, architecture, security, and testing — not in the number
of technologies.

## Table of contents

- [Problem statement](#problem-statement)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Database schema](#database-schema)
- [Blood compatibility](#blood-compatibility-iscompatible)
- [Donor matching & ranking engine](#donor-matching--ranking-engine-the-core-feature)
- [Request state machine](#request-state-machine)
- [Notifications](#notifications)
- [Authentication](#authentication)
- [Authorization](#authorization-ownership-checks)
- [Frontend](#frontend)
- [Security](#security)
- [REST API reference](#rest-api-reference)
- [Running locally](#running-locally)
- [Testing](#testing)
- [Deployment](#deployment)
- [Limitations](#limitations)
- [Future improvements](#future-improvements)

## Problem statement

Right now, when someone urgently needs blood, coordination usually happens
manually — phone calls, WhatsApp forwards to random groups — with no
systematic way to check blood-group compatibility, donor availability,
proximity, or urgency. This is slow, error-prone, and doesn't prioritize
genuine emergencies. BloodConnect automates the **discovery and
coordination** step: given a blood request, it finds compatible, available
donors and ranks them so the most relevant ones are contacted first.

**BloodConnect is a coordination tool, not a medical authority.** Final
blood compatibility and donor eligibility must always be verified by
qualified medical professionals and blood banks before any real donation.
Nothing in this app makes a clinical decision.

## Features

**For recipients:**
- Create a blood request (blood group, units, city, urgency, optional
  description/deadline)
- Trigger donor matching and see a ranked list of eligible donors
- Track request status through its full lifecycle (open → matching →
  donor contacted → accepted → fulfilled)
- Get notified when donors are contacted, accept, or decline
- Cancel a request, or mark it fulfilled once a donation happens

**For donors:**
- Set up a donor profile (blood group, city, optional coordinates)
- Toggle availability on/off
- See incoming requests matched to them and accept/decline
- Track a personal reliability score, driven by their own donation history
- Browse other donors and active requests

**System:**
- Deterministic ABO/Rh blood-compatibility screening (no invented rules)
- Distance-aware, urgency-aware, reliability-aware donor ranking
- A validated request-status state machine (no illegal transitions)
- Database-backed in-app notifications
- JWT authentication + resource-level authorization (ownership checks)
- Centralized error handling, CORS, and basic rate limiting

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router | Industry-standard, fast dev loop, no CSS-file sprawl |
| Backend | Node.js, Express.js | Same language as the frontend; minimal, well-understood framework |
| Database | PostgreSQL (Neon in production), Prisma ORM | Our data is relational (users, requests, matches all reference each other) — a relational DB with real foreign keys fits better than a document store |
| Auth | JWT + bcrypt | Stateless auth; passwords never stored in plain text |
| Testing | Node's built-in test runner (`node --test`) | No extra test framework dependency needed |
| Deployment | Vercel (frontend), Render (backend), Neon (DB) | Free tiers, straightforward Git-based deploys |

No Docker, Kubernetes, MongoDB, Redis, Kafka, microservices, GraphQL, or
AI/LLM anywhere in this stack — deliberately. See "Donor matching &
ranking engine" below for why the core feature is a deterministic
algorithm, not a model.

## Architecture

```
┌──────────────────┐         HTTP (JSON, REST)          ┌──────────────────┐
│  React Frontend   │ ───────────────────────────────>  │  Express Backend │
│  (Vite, Tailwind)  │ <───────────────────────────────  │   (Node.js)      │
└──────────────────┘          JSON response              └────────┬─────────┘
                                                                   │
                                                            Prisma ORM
                                                                   │
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │   PostgreSQL     │
                                                          │   (Neon)         │
                                                          └──────────────────┘
```

Classic 3-tier architecture: **presentation** (React), **application**
(Express — routes → controllers → services), **data** (PostgreSQL via
Prisma). Within the backend, responsibilities are deliberately layered:

- **Routes** (`src/routes/`) only wire URLs to controller functions.
- **Controllers** (`src/controllers/`) handle HTTP concerns — parse the
  request, validate input shape, call a service, shape the response.
  They contain no business logic.
- **Services** (`src/services/`) hold the actual business logic (the
  matching engine, the state machine, ownership checks) and talk to the
  database via Prisma. Most services are plain functions that take/return
  plain objects, which is what makes them easy to unit test.
- **Middleware** (`src/middleware/`) — authentication, error handling,
  rate limiting — cross-cutting concerns that wrap routes.

**Example request flow — a recipient creates an emergency request and
finds donors:**

1. `POST /api/requests` — `requireAuth` verifies the JWT, `bloodRequestController.create`
   validates the body, `bloodRequestService.createBloodRequest` inserts a
   row (`status: OPEN`).
2. `GET /api/requests/:id/matches` — `matchService.findMatchesForRequest`
   transitions the request to `MATCHING`, fetches every `DonorProfile`,
   runs `bloodMatchingEngine.rankDonorsForRequest` (hard-filters by
   compatibility/availability/self-match, scores by proximity + urgency +
   reliability), persists the ranked results as `DonorMatch` rows,
   transitions the request to `DONOR_CONTACTED`, and creates a
   `MATCH_FOUND` notification for each newly matched donor.
3. A donor calls `POST /api/matches/:id/accept` — ownership is checked
   against the *donor's* user id (not the recipient's), the match and
   request both update, the donor's reliability counters update, and the
   recipient gets a `DONOR_ACCEPTED` notification.
4. The recipient calls `PUT /api/requests/:id/status` with `FULFILLED` —
   the state machine validates the transition, and the donor who was
   accepted gets their `donationsCompleted` counter incremented and a
   `REQUEST_FULFILLED` notification.

Every step above is a real, tested code path — not a hypothetical.

## Project structure

```
bloodconnect-donor-matching/
├── render.yaml          Render Blueprint — backend deploy config
├── frontend/   React app (Vite + Tailwind + React Router)
│   ├── vercel.json       SPA rewrite so React Router routes work on Vercel
│   └── src/
│       ├── api/               one small module per backend resource
│       │   ├── client.js      shared fetch wrapper (auth header, JSON, errors)
│       │   └── auth.js, requests.js, donors.js, matches.js, notifications.js
│       ├── context/
│       │   └── AuthContext.jsx   user/token state, login/register/logout
│       ├── components/
│       │   ├── Navbar.jsx         auth-aware nav
│       │   ├── ProtectedRoute.jsx redirects to /login if logged out
│       │   └── Badges.jsx         UrgencyBadge, StatusBadge (shared)
│       ├── utils/
│       │   └── formatters.js  blood group / urgency / status labels (mirrors backend)
│       ├── pages/
│       │   ├── Landing.jsx, Register.jsx, Login.jsx
│       │   ├── Dashboard.jsx      donor status + incoming/accepted matches
│       │   │                      + recipient's own requests, in one page
│       │   ├── DonorProfile.jsx, CreateRequest.jsx
│       │   ├── MyRequests.jsx, RequestDetails.jsx
│       │   └── FindDonors.jsx, Notifications.jsx, Settings.jsx
│       ├── App.jsx      route table
│       └── main.jsx     AuthProvider + BrowserRouter
├── backend/    Express API server
│   └── src/
│       ├── controllers/
│       │   ├── authController.js         register/login/me
│       │   ├── bloodRequestController.js create/list/get/update/status/cancel
│       │   ├── donorController.js        me/profile/availability/browse
│       │   ├── matchController.js        mine/find matches/accept/decline
│       │   └── notificationController.js list/mark read
│       ├── routes/
│       │   ├── authRoutes.js, bloodRequestRoutes.js, donorRoutes.js
│       │   └── matchRoutes.js, notificationRoutes.js
│       ├── services/
│       │   ├── authService.js            auth business logic (bcrypt + JWT)
│       │   ├── bloodRequestService.js    CRUD + ownership + state transitions
│       │   ├── donorService.js           donor profile CRUD + sanitization
│       │   ├── matchService.js           orchestrates matching + accept/decline
│       │   ├── notificationService.js    create/list/mark-read
│       │   ├── bloodCompatibility.js     isCompatible() — ABO/Rh screening rule
│       │   ├── proximity.js              Haversine distance + proximity score
│       │   ├── donorReliability.js       reliability score from donor history
│       │   ├── bloodMatchingEngine.js    hard filters + ranking (the core feature)
│       │   └── requestStateMachine.js    valid BloodRequest.status transitions
│       ├── middleware/
│       │   ├── authMiddleware.js   requireAuth — protects routes via JWT
│       │   ├── asyncHandler.js     forwards async errors to errorHandler
│       │   ├── errorHandler.js     centralized error + 404 responses
│       │   └── rateLimiter.js      basic rate limit on auth endpoints
│       ├── utils/
│       │   ├── prisma.js, jwt.js, validators.js, httpErrors.js, formatters.js
│       ├── tests/          20 test files, 80 tests total (see Testing below)
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
  `Urgency` (NORMAL/URGENT/EMERGENCY), `RequestStatus` (see the state
  machine below), `MatchStatus` (PENDING/ACCEPTED/DECLINED).
- A user is *not* tagged with a fixed "donor" or "recipient" role — they
  become a donor the moment a `DonorProfile` row exists for them, and can
  independently create `BloodRequest`s. This avoids an artificial
  restriction (a donor should still be able to request blood for someone
  else).
- `DonorProfile.userId` is `@unique`, which is what makes User↔DonorProfile
  one-to-one instead of one-to-many.
- `DonorMatch` is a join table between `BloodRequest` and `DonorProfile`
  carrying its own data (`score`, `status`); a unique constraint on
  `(requestId, donorProfileId)` stops duplicate matches, and its foreign
  keys are the reason a `BloodRequest` can never be hard-deleted once
  matches exist (see "delete = cancel" under the state machine).
- Kept intentionally un-over-normalized: `city` is a plain string field
  on both `BloodRequest` and `DonorProfile`, not a separate `City` table
  — the extra join would add complexity with no real benefit at this
  project's scale.

Prisma migrations are committed under `backend/prisma/migrations/` — the
exact, versioned SQL history of how this schema was built, replayable by
anyone with `npx prisma migrate dev`.

## Blood compatibility (`isCompatible`)

`backend/src/services/bloodCompatibility.js` exports one pure function:

```js
isCompatible(donorBloodGroup, recipientBloodGroup) // -> boolean
```

It implements the standard **ABO/Rh** red-cell transfusion compatibility
model — not an invented rule. The core idea: red blood cells carry
**antigens** (A, B, and Rh), and a transfusion is safe only when the
donor's antigens are a subset of the recipient's antigens (nothing
"foreign" for the recipient's immune system to attack):

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
   donor is excluded entirely, not just penalized, if any fails:
   - **Blood-group compatibility** — `isCompatible(donor.bloodGroup, request.bloodGroup)`
   - **Availability** — `donor.isAvailable === true`
   - **Not the requester themselves** — `donor.userId !== request.requesterId`

   A high score from being nearby must never be able to "outweigh" being
   medically incompatible — that's why these are filters, not scored
   inputs.

2. **Ranking score** (`scoreDonor`) — among donors who passed every hard
   filter, three factors combine into a `totalScore` (0–100):

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

**Privacy:** a donor's exact latitude/longitude is used only inside
`calculateProximityScore`'s internal Haversine calculation — it is never
returned in any API response. Only the resulting *score* leaves this
function, so a donor's precise location is never exposed publicly (`GET
/api/donors` strips coordinates before responding).

**Connected to real HTTP:** `GET /api/requests/:id/matches` calls
`matchService.findMatchesForRequest`, which fetches real `DonorProfile`
rows, runs `rankDonorsForRequest`, and persists each result as a
`DonorMatch` (`upsert`, keyed on `(requestId, donorProfileId)`, so
re-running it updates scores instead of creating duplicates). It also
drives the state machine: `OPEN → MATCHING` before searching, then
`MATCHING → DONOR_CONTACTED` once at least one eligible donor is found.

I verified the full engine against real Postgres data (not just hand-built
test objects): seeded 5 donors with different blood groups, cities,
coordinates, and reliability histories against a real `EMERGENCY A_POS`
request, fetched everything back through Prisma, and ran the actual
`rankDonorsForRequest`:

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

### Three real bugs, found by actually running the app — not by reading the code

**1. Re-matching a request that had already advanced.** The first version
of `findMatchesForRequest` called `rankDonorsForRequest` unconditionally,
which internally validates the request is still `OPEN`/`MATCHING`. Once
the *first* call advanced the request to `DONOR_CONTACTED`, a *second*
call to the same endpoint (e.g. a recipient just refreshing the page)
failed with a `400`, even though nothing was wrong. Caught by literally
calling the endpoint twice against the running server. **Fix:** if the
request is no longer in a searchable state, just return the
already-persisted matches instead of re-running the engine.

A related correctness detail from the same fix: naively incrementing a
donor's `requestsReceived` on every call would inflate it on every
refresh, unfairly *lowering* their reliability score. Fixed by comparing
`match.createdAt.getTime() === match.updatedAt.getTime()` right after the
`upsert` (only equal the instant a row is first created), so the counter
increments once per donor per request, not once per API call.

**2. Self-matching.** A single user who registers as both donor and
recipient — the natural thing to do while manually testing the app —
got matched to their own request. No backend test had ever modeled one
person filling both roles, because every test used separate users for
recipient and donor. Found the first time I actually clicked through the
app as one person, in a real browser. **Fix:** the third hard filter
above. This also revealed the existing test fixtures had accidentally
been testing this exact broken case the whole time — both
`donor.userId` and `request.requesterId` defaulted to `undefined`, which
is `===` to itself in JavaScript, so every "different donor" test in that
file was silently a self-match. Fixed the fixtures and added a dedicated
test.

**3. A testing-hygiene bug that cascaded.** Every integration test's
cleanup call sat at the *end* of the test body. The moment any assertion
threw, the function exited early and cleanup never ran, leaving rows
behind. Invisible most of the time — but `findMatchesForRequest` queries
*every* `DonorProfile` in the table (correct in production), so one failed
run's leftover donor silently inflated a *different*, correct test's
match count on the *next* run. Caught when a genuinely correct test failed
with "expected 1, got 4" right after the self-match fix. **Fix:** wrapped
every test body in `try { ... } finally { await cleanupScenario(...) }`,
so cleanup runs whether the test passes or fails.

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
listed. `PUT /api/requests/:id/status` is the only way to change status.

**Why a dedicated function instead of checking status inline wherever
it's needed?** A business rule like "a fulfilled request can never be
reopened" is an invariant that must hold everywhere the data can be
touched — not just in the one route a developer remembers to guard.
Centralizing it means every caller automatically gets the same guarantee.

**A real bug this fixed:** before the state machine existed,
`PUT /api/requests/:id` accepted a `status` field in the body and wrote
it straight to the database with zero validation —
`{"status": "FULFILLED"}` would have silently "completed" a request still
sitting at `OPEN` with no donor ever contacted. `updateBloodRequest` now
explicitly rejects any `status` field with a `400`, and cancelling
(`DELETE`) is rewritten to go through the state machine, so cancelling an
already-`FULFILLED` request is correctly rejected instead of silently
"succeeding." Verified live: walked a real request through the full
happy path (`OPEN → MATCHING → DONOR_CONTACTED → ACCEPTED → FULFILLED`),
then confirmed `FULFILLED → OPEN` and `DELETE` on that same request are
both correctly rejected with `400`.

**Two authorization paths onto the same state machine.** The public,
owner-checked `transitionBloodRequestStatus` (used by `PUT
/:id/status`) is for the *recipient* — fine for cancelling their own
request. But a *donor* accepting a match needs to drive
`DONOR_CONTACTED → ACCEPTED`, and they're never the request's owner.
Rather than weaken the ownership check, `bloodRequestService.js` exposes
a second, internal `applyRequestStatusTransition` with no ownership check
at all — used only by `matchService.js`, which has already verified a
*different* ownership relationship (the donor owns the `DonorMatch`)
before calling it. The state-machine rule itself is enforced identically
either way; only "who's allowed to trigger this" differs by caller.

## Notifications

Database-backed only — no SMS, WhatsApp, Firebase, or Socket.io.
`notificationService.js` is deliberately tiny: `createNotification`,
`listNotificationsForUser`, `markNotificationRead` (ownership-checked,
same `assertOwnership` pattern as everything else). The triggering logic
lives where each *event* happens — `matchService.js` — not inside the
notification service, since that service shouldn't need to know *why*
it's being called.

| Event | Recipient of the notification | Type |
|---|---|---|
| A donor is newly matched | The donor | `MATCH_FOUND` |
| Donors found/contacted for a request (first time) | The recipient | `DONOR_CONTACTED` |
| A donor accepts | The recipient | `DONOR_ACCEPTED` |
| A donor declines | The recipient | `DONOR_DECLINED` |
| Request marked `FULFILLED` | The donor who was `ACCEPTED` | `REQUEST_FULFILLED` |

The `MATCH_FOUND` message is built from the request's own urgency and
blood group — e.g. `"Emergency A+ blood request near you."` — using two
tiny formatting helpers rather than hardcoding a message per blood group.

**Closing a real gap:** `DonorProfile.donationsCompleted` — the field the
reliability score has depended on since the matching engine was built —
had never actually been incremented anywhere until notifications were
wired up. `rewardDonorOnFulfilled(requestId)` (called from the controller
only when a request's new status is `FULFILLED`) finds the request's
`ACCEPTED` `DonorMatch`, increments that donor's `donationsCompleted`, and
sends the `REQUEST_FULFILLED` notification. This function lives in
`matchService.js`, not `bloodRequestService.js` — putting it there would
require importing from `matchService.js`, which already imports from
`bloodRequestService.js`, creating a circular dependency. Keeping the
"reward the donor" orchestration in the controller, calling into whichever
service owns each piece of data, avoids that.

Verified the entire chain live: `MATCH_FOUND` reached the donor reading
exactly `"Emergency A+ blood request near you."`, the recipient got
`DONOR_CONTACTED` then `DONOR_ACCEPTED`, marking `FULFILLED` sent
`REQUEST_FULFILLED` *and* bumped `donationsCompleted` from 0 to 1, marking
a notification read worked, and a different user trying to mark someone
else's notification read correctly got `403`.

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
- **Protected routes** — any route using the `requireAuth` middleware
  requires an `Authorization: Bearer <token>` header. The middleware
  verifies the token's signature, re-fetches the user from the database
  (so a deleted/changed user can't keep using an old token), and attaches
  it as `req.user`.
- **Logout strategy** — JWTs are stateless, so "logout" simply means the
  frontend deletes the token it's holding. The server doesn't track
  sessions to invalidate. Trade-off: a stolen token stays valid until it
  expires (7 days) — see Limitations.
- **Authentication vs. authorization:** authentication answers *"who are
  you?"*. Authorization answers *"what are you allowed to do?"* — see below.

## Authorization (ownership checks)

Being logged in is not the same as being allowed to touch a specific piece
of data. `BloodRequest` is the first example:

| Action | Endpoint | Who can do it |
|---|---|---|
| Create | `POST /api/requests` | Any logged-in user (becomes the owner) |
| List / view | `GET /api/requests`, `GET /api/requests/:id` | Any logged-in user — donors need to *browse* requests to be matched, so reads are intentionally open |
| Update (fields) | `PUT /api/requests/:id` | **Only the owner** (cannot change `status`) |
| Update (status) | `PUT /api/requests/:id/status` | **Only the owner**, and only to a valid next state |
| Cancel | `DELETE /api/requests/:id` | **Only the owner**, and only if the current status allows a transition to `CANCELLED` |

The check lives in `bloodRequestService.js`, not the route or controller —
`updateBloodRequest`/`cancelBloodRequest` load the request, then call
`assertOwnership(request.requesterId, requestingUserId, ...)`
(`utils/httpErrors.js`), throwing `403` if the IDs don't match. This is the
fix for the classic **IDOR (Insecure Direct Object Reference)**
vulnerability: without this check, User B could edit or delete User A's
request just by changing the ID in the URL — a valid JWT alone proves
nothing about *which resource* B should be touching.

`assertOwnership` is written generically (owner id vs. requesting-user id,
not tied to `BloodRequest`), so the same one-liner protects `DonorMatch`
too — accepting/declining a match checks `donorProfile.userId` (the
matched donor), not `requesterId`. Same helper, different owner field.

Verified against the real running server: registered two users, had User A
create a request, confirmed User B gets `403` on `PUT`/`DELETE` but `200`
on `GET` (open browsing), while User A gets `200` on all three.

## Frontend

**Architecture:**
- `api/client.js` — one shared `fetch` wrapper. Every other `api/*.js`
  file is a thin, resource-named set of functions built on top of it, so
  a page component never calls `fetch` directly.
- `context/AuthContext.jsx` — React Context holding `{ user, token }`.
  The JWT is persisted to `localStorage` (the backend is stateless, so
  the *browser* has to remember who's logged in) and re-validated against
  `GET /api/auth/me` on load, so a stale/expired token doesn't leave the
  UI stuck pretending someone is logged in.
- `components/ProtectedRoute.jsx` — redirects to `/login` if there's no
  user. This is a **UX** convenience only — the real security boundary is
  each endpoint's `requireAuth` middleware on the backend.

**Pages:** `Dashboard.jsx` combines the donor view (profile summary,
reliability score, availability toggle, incoming/accepted matches) and the
recipient view (own requests, emergencies visually flagged) in one page,
since most users use both roles over time. `RequestDetails.jsx` exposes
"Find Matching Donors," "Mark as Fulfilled," and "Cancel" to the owner,
each gated by the current `status` — the frontend hides invalid actions
for UX, and the backend refuses them regardless (defense in depth).

Verified in a real browser with Playwright, not just by reading the code:
registered two separate users, walked the entire donor↔recipient loop end
to end, and screenshotted every step. This is how the self-match bug above
was actually found.

## Security

- **Password hashing (bcrypt)** and **JWT authentication**.
- **Authorization / ownership checks** on every resource that has an
  owner, via one generic `assertOwnership` helper.
- **Server-side input validation on every write**, independent of
  whatever the frontend's HTML form attributes already checked — the
  frontend validation is a UX nicety, not a security boundary; nothing
  stops a request from being sent with `curl` instead of through the
  React app.
- **CORS** — `cors({ origin: allowedOrigins })`, reading `FRONTEND_URL`
  from the environment (with `localhost:5173` as a dev-only fallback).
  In production, no `FRONTEND_URL` means **no** browser origin is
  allowed — fail closed, not open.
- **Centralized error handling** — `asyncHandler` forwards a thrown/
  rejected error to `errorHandler.js` (registered last in `app.js`)
  instead of every controller repeating its own try/catch (removed ~20
  duplicated blocks). A genuinely unexpected error (500) returns a
  generic message and gets logged server-side, instead of leaking
  `err.message` (which could contain internal details) to the client;
  expected errors (400/401/403/404, always thrown via `httpError()`)
  still return their real, safe-by-construction message.
- **Basic rate limiting** (`express-rate-limit`) — `/api/auth/register`
  and `/api/auth/login` share a budget of 20 requests per IP per 15
  minutes, stopping naive brute-force. Deliberately not applied
  globally.
- **Environment variables** — `DATABASE_URL`, `JWT_SECRET`,
  `FRONTEND_URL` all read from `.env` (gitignored), documented in
  `.env.example` with no real secret committed. `JWT_SECRET` has no
  insecure fallback — signing with `undefined` throws immediately.

**Explicitly out of scope**, per the project's own goal of staying
practical rather than becoming a cybersecurity project: no `helmet`
security-headers middleware, no CSRF protection (not needed for a
stateless Bearer-token API — CSRF is a cookie-auth problem), no input
sanitization library, no dependency-vulnerability scanning.

Verified live: CORS header present for the allowed origin, absent for
`evil.com`; unknown routes return a clean `404`; a real thrown error
(duplicate email) still returns its correct `409` through the centralized
pipeline; 25 rapid login attempts got blocked with `429` exactly at the
configured threshold.

## REST API reference

| Method & Path | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | — | Create a user, returns `{ user, token }` |
| `POST /api/auth/login` | — | Returns `{ user, token }` |
| `GET /api/auth/me` | required | Current user |
| `POST /api/requests` | required | Creates a `BloodRequest`, caller becomes the owner |
| `GET /api/requests` | required | List all requests (open browsing) |
| `GET /api/requests/:id` | required | One request (open browsing) |
| `PUT /api/requests/:id` | owner only | Update fields — **not** `status` |
| `PUT /api/requests/:id/status` | owner only | The only way to change `status`; validated by the state machine |
| `DELETE /api/requests/:id` | owner only | Cancels via the state machine, not a hard delete |
| `GET /api/requests/:id/matches` | owner only | Runs the matching engine, persists `DonorMatch` rows, advances status |
| `GET /api/donors/me` | required | The caller's own `DonorProfile` (full record), or `null` if none yet |
| `PUT /api/donors/profile` | required | Create/update the caller's own `DonorProfile` (upsert, self-scoped) |
| `PUT /api/donors/availability` | required | Toggle the caller's own `isAvailable` |
| `GET /api/donors` | required | Browse donors (sanitized); optional `?bloodGroup=`, `?city=` filters |
| `GET /api/donors/:id` | required | One donor's sanitized public profile |
| `GET /api/matches/mine` | required | The caller's own `DonorMatch` rows (as a donor); optional `?status=` filter |
| `POST /api/matches/:id/accept` | matched donor only | Match → `ACCEPTED`, request → `ACCEPTED`; notifies the recipient |
| `POST /api/matches/:id/decline` | matched donor only | Match → `DECLINED`, request → `MATCHING`; notifies the recipient |
| `GET /api/notifications` | required | The caller's own notifications, newest first |
| `PUT /api/notifications/:id/read` | owner only | Marks one notification as read |

**A deliberate REST-semantics trade-off:** `GET /api/requests/:id/matches`
both triggers the matching engine *and* returns results, even though a
`GET` is supposed to be side-effect-free per HTTP semantics. A stricter
design would split this into a `POST` (trigger) and a read-only `GET`
(list). Implemented this way to match the endpoint shape most commonly
expected for this kind of feature; the trade-off is documented, not
hidden.

## Running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL, JWT_SECRET, FRONTEND_URL
npx prisma migrate dev # creates tables from prisma/schema.prisma
npm run dev
```

- **`DATABASE_URL`** — local Postgres:
  `postgresql://postgres:postgres@localhost:5432/bloodconnect` (create
  the DB first: `createdb bloodconnect`). Production (Neon): copy the
  connection string from your Neon dashboard — it already includes
  `?sslmode=require`.
- **`JWT_SECRET`** — generate your own:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Never commit the real value or reuse it across environments.
- **`FRONTEND_URL`** — controls CORS; set to wherever your frontend
  actually runs.

Backend runs at `http://localhost:5000`. Health check (also pings the DB):
`curl http://localhost:5000/api/health` →
`{"message":"BloodConnect backend is running","database":"connected"}`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:5000
npm run dev
```

Frontend runs at `http://localhost:5173`. With the backend also running,
open it in a browser: register two accounts (one donor, one recipient),
set up a donor profile, create a blood request, click "Find Matching
Donors."

## Testing

```bash
cd backend
npm test
```

Runs Node's built-in test runner (`node --test`) against
`backend/src/tests/*.test.js` — **80 tests**. Auth, blood-request, donor,
match, and notification tests are integration tests — they hit a real
Postgres database through Prisma, not a mock, and clean up after
themselves (see the testing-hygiene bug above for why that cleanup is in
a `finally` block). `bloodCompatibility.test.js`, `proximity.test.js`,
`donorReliability.test.js`, `bloodMatchingEngine.test.js`, and
`requestStateMachine.test.js` are pure unit tests — no database involved.

Coverage includes: registration/login/duplicate-email/wrong-password,
auth-middleware rejection, blood-request CRUD + ownership rejection
(the IDOR check), all 64 ABO/Rh compatibility combinations, Haversine
distance correctness and proximity score buckets, reliability scoring,
the matching engine (hard filters + ranking + the self-match filter),
the request state machine (every valid transition, the `FULFILLED →
OPEN` rejection from the spec's own example, skipped-step rejection,
non-owner rejection), donor profile CRUD + sanitization + filtering, the
full match lifecycle (matching creates `DONOR_CONTACTED`, accept drives
`ACCEPTED` and updates reliability counters, decline bounces back to
`MATCHING`, double-accept/decline rejected), and notifications (creation,
ordering, ownership-checked mark-as-read, and that every match-lifecycle
event fires the right notification to the right person).

No frontend automated tests — the frontend was verified with real,
scripted browser sessions (Playwright) instead, which is how the
self-match bug was actually found; see Limitations.

## Deployment

Three free-tier services, each doing one job: **Neon** hosts the
database, **Render** hosts the Express API, **Vercel** hosts the React
app. Deploy in this order — the backend needs the database, and the
frontend needs the backend's URL.

### 1. Database — Neon

1. Create a free account at [neon.tech](https://neon.tech) and a new project.
2. Copy the connection string from the dashboard (**Connection Details** →
   pick the pooled connection string). It looks like
   `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`.
3. Keep this — it's your production `DATABASE_URL`.

### 2. Backend — Render

The repo includes `render.yaml` (a Render **Blueprint**), so Render can
configure most of this automatically:

1. Push this repo to GitHub (already done if you're reading this there).
2. On [render.com](https://render.com), **New → Blueprint**, connect the
   repo. Render reads `render.yaml` and pre-fills the service (root
   directory `backend`, build command, start command, `JWT_SECRET`
   auto-generated).
3. It will prompt you for the two values it can't know on its own:
   - `DATABASE_URL` — the Neon connection string from step 1
   - `FRONTEND_URL` — leave blank for now; you'll set it after step 3
     below, once you have a Vercel URL
4. Deploy. Confirm with `curl https://<your-render-url>/api/health` —
   expect `{"message":"...","database":"connected"}`.

*(No `render.yaml`, or prefer doing it by hand? **New → Web Service**
instead, and set root directory `backend`, build command
`npm install && npx prisma migrate deploy && npx prisma generate`
— `migrate deploy` applies committed migrations without prompting, the
production-safe counterpart to `migrate dev` which is for local dev only
— start command `npm start`, and the same three env vars above plus your
own `JWT_SECRET`, generated the same way as local dev and never reused
from your `.env`.)*

### 3. Frontend — Vercel

`frontend/vercel.json` is already in the repo — it rewrites every path to
`index.html` so React Router's client-side routes (e.g. `/dashboard`,
`/requests/:id`) work on direct load/refresh instead of 404ing (Vercel's
static hosting otherwise looks for a matching file per URL, which a
single-page app doesn't have).

1. On [vercel.com](https://vercel.com), **New Project**, import the same
   repo.
2. **Root directory:** `frontend`
3. **Framework preset:** Vite (auto-detected)
4. **Environment variable:** `VITE_API_URL` = your Render backend URL
   from step 2 (e.g. `https://bloodconnect-backend.onrender.com`)
5. Deploy. Vercel gives you a URL like `https://bloodconnect.vercel.app`.
6. **Go back to Render** and set `FRONTEND_URL` to this exact Vercel URL,
   then redeploy the backend (or it'll restart automatically on the env
   var change) — without this, CORS will block the deployed frontend
   from calling the deployed backend.

### Production vs. development

The only things that differ between environments are the three backend
env vars (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`) and the frontend's
`VITE_API_URL` — no code branches on `NODE_ENV` anywhere in this project.
That's intentional: the same code path runs in both places, so "it works
locally" is a meaningful signal about production behavior, and there's
nothing environment-specific to accidentally leave untested.

**Why secrets are never committed:** `.env` is gitignored (`.env.example`
documents the shape without real values) because a committed
`DATABASE_URL` or `JWT_SECRET` would let anyone who can read the repo
connect to the production database or forge valid login tokens for any
user — a public GitHub repo with a real secret in its history is
effectively a public secret, even if you delete the file in a later
commit (it's still in git history).

## Limitations

- If two donors are both `PENDING` on the same request and one accepts,
  the other's `PENDING` match is left dangling rather than being
  auto-declined. Accepting it later correctly fails (`400`), but a nicer
  UX would proactively decline remaining pending matches (and notify
  those donors) the moment one is accepted.
- `GET /api/requests/:id/matches` intentionally has a side effect (see
  the REST-semantics note above) — a stricter API would split trigger
  and read into separate endpoints.
- No push/email/SMS delivery — notifications only exist inside the
  database until the frontend polls `GET /api/notifications`. This is
  intentional scope, not an oversight — the spec explicitly calls for
  in-app notifications only.
- Notifications don't store a link back to the request/match that
  triggered them — a deliberate scope decision to avoid a schema
  migration for something the frontend can approximate (routing by
  notification `type` rather than deep-linking the exact resource).
- The Dashboard filters the current user's own requests client-side from
  `GET /api/requests` (which returns everyone's, by design) — fine at
  this project's scale, but a real product would add a server-side
  `?mine=true` filter.
- No frontend automated tests (no component-level Vitest suite) — the
  frontend was verified with real, scripted browser sessions instead,
  which is how the self-match bug was actually found. Formal frontend
  test coverage is not currently planned, to keep testing effort
  concentrated on the backend business logic.
- Logout is client-side only (delete the token) — no server-side token
  blacklist, so a stolen token remains valid until it expires (7 days).
- Rate limiting is in-memory — fine for a single server process, but it
  resets on restart and isn't shared across multiple instances behind a
  load balancer. A multi-instance deployment would need a shared store
  (e.g. Redis-backed) — out of scope for this project's single-instance
  deployment target.
- No automated tests for the security middleware itself (CORS, rate
  limiting, centralized error handling) — thin, well-verified wrappers
  around mature libraries and Express's own error routing, verified live
  against the running server instead.
- Reliability score is a simple rule-based metric (acceptance rate +
  capped completion bonus), not a statistically validated model — by
  design, so it stays simple enough to explain and audit.
- Location may be approximate — proximity falls back to a same-city/
  different-city guess when exact coordinates aren't provided, since
  requesting precise GPS coordinates from every user isn't realistic.
- The system does not guarantee donor availability or replace hospitals/
  blood banks — it is a discovery-and-coordination tool only. Final
  compatibility and eligibility must always be verified medically.

## Future improvements

Concretely, without adding any new categories of technology:

- Auto-decline remaining `PENDING` matches (and notify those donors) the
  moment one donor is accepted for a request.
- A `relatedRequestId` (nullable FK) on `Notification`, so the frontend
  can deep-link a notification straight to the relevant request/match
  instead of routing generically by type.
- Server-side `GET /api/requests?mine=true` instead of client-side
  filtering on the Dashboard.
- Split `GET /api/requests/:id/matches` into a stricter `POST` (trigger)
  + read-only `GET` (list), for full REST-semantics correctness.
- A short-lived access token + refresh token pair, with server-side
  refresh-token revocation, instead of one long-lived JWT with no
  blacklist.
- A Redis-backed rate-limit store, if ever deployed across multiple
  backend instances.
- A component-level frontend test suite (Vitest + React Testing
  Library), to catch UI regressions the same way the backend's 80 tests
  catch business-logic regressions.
- Optional in-app "push" via the Notifications page polling more
  aggressively, or a simple long-poll — still no third-party service,
  just tightening the existing in-app mechanism.

None of these require introducing MongoDB, Redis, Kafka, Kubernetes,
Docker, microservices, GraphQL, or AI/ML — the project's stated design
goal is to stay simple in its technology choices and demonstrate depth in
its logic, architecture, and testing instead.
