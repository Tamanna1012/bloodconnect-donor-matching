# BloodConnect

Blood Donor–Recipient Matching & Emergency Alert System.

> **Status: Phase 11 — Frontend.** The backend is functionally complete
> (auth, authorization, matching, reliability, state machine, REST APIs,
> notifications) and now has a full React frontend on top of it: Landing,
> Register, Login, Dashboard, Donor Profile, Create Request, My Requests,
> Request Details, Find Donors, Notifications, Settings. The complete
> donor↔recipient loop — register, set up a donor profile, create a
> request, find matches, accept, get notified, mark fulfilled — was
> verified end to end in a real browser, which surfaced and fixed two
> genuine bugs a code-only review wouldn't have caught (see "Donor
> matching & ranking engine" and "Testing" below). What's left is security
> hardening and deployment. This README will be expanded into a full
> project write-up (architecture, matching algorithm, API reference,
> setup, testing, deployment, limitations) as remaining phases are
> completed.

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
│   └── src/
│       ├── api/               one small module per backend resource
│       │   ├── client.js      shared fetch wrapper (auth header, JSON, errors)
│       │   ├── auth.js, requests.js, donors.js, matches.js, notifications.js
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
│       │   ├── FindDonors.jsx, Notifications.jsx, Settings.jsx
│       ├── App.jsx      route table
│       └── main.jsx     AuthProvider + BrowserRouter
├── backend/    Express API server
│   └── src/
│       ├── controllers/
│       │   ├── authController.js         register/login/me request handlers
│       │   ├── bloodRequestController.js create/list/get/update/status/cancel
│       │   ├── donorController.js        me/profile/availability/browse
│       │   ├── matchController.js        mine, find matches, accept, decline
│       │   └── notificationController.js list, mark read
│       ├── routes/
│       │   ├── authRoutes.js             POST /register, POST /login, GET /me
│       │   ├── bloodRequestRoutes.js     /api/requests CRUD + /:id/matches
│       │   ├── donorRoutes.js            /api/donors (+ /me)
│       │   ├── matchRoutes.js            /api/matches/mine, /:id/accept, /decline
│       │   └── notificationRoutes.js     /api/notifications
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
│       │   └── authMiddleware.js   requireAuth — protects routes via JWT
│       ├── utils/
│       │   ├── prisma.js           shared PrismaClient instance
│       │   ├── jwt.js              sign/verify JWT helpers
│       │   ├── validators.js       email/password/blood-group/urgency/coordinate checks
│       │   ├── httpErrors.js       assertFound / assertOwnership helpers
│       │   └── formatters.js       human-readable blood group / urgency labels
│       ├── tests/
│       │   ├── auth.service.test.js
│       │   ├── authMiddleware.test.js
│       │   ├── bloodRequest.service.test.js
│       │   ├── donorService.test.js
│       │   ├── matchService.test.js
│       │   ├── notificationService.test.js
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
   donor is excluded entirely, not just penalized, if any fails:
   - **Blood-group compatibility** — `isCompatible(donor.bloodGroup, request.bloodGroup)`
   - **Availability** — `donor.isAvailable === true`
   - **Not the requester themselves** — `donor.userId !== request.requesterId`
     (added in Phase 11 — see the bug writeup below)

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

**Now connected to real HTTP (Phase 9):** `GET /api/requests/:id/matches`
calls `matchService.findMatchesForRequest`, which fetches real
`DonorProfile` rows, runs `rankDonorsForRequest`, and persists each result
as a `DonorMatch` (`upsert`, keyed on `(requestId, donorProfileId)`, so
re-running it updates scores instead of creating duplicates). It also
drives the state machine: `OPEN → MATCHING` before searching, then
`MATCHING → DONOR_CONTACTED` once at least one eligible donor is found.

**A real bug I found by testing the flow twice:** the first version of
this function called `rankDonorsForRequest` unconditionally — which
internally calls `validateRequestForMatching`, and that function correctly
refuses to match a request that isn't `OPEN`/`MATCHING`. The problem: once
the *first* call advances the request to `DONOR_CONTACTED`, a *second*
call to the same endpoint (e.g. the recipient just refreshing the page to
view matches) would hit that same validation and fail with `400 Cannot
find donors for a request with status "DONOR_CONTACTED"` — even though
nothing was actually wrong. I caught this by literally calling the
endpoint twice against the running server, not just once. Fix:
`findMatchesForRequest` now checks whether the request is still in a
searchable state (`OPEN`/`MATCHING`) first; if not, it just returns the
already-persisted matches instead of re-running the engine.

A related correctness detail: naively incrementing a donor's
`requestsReceived` counter on every call would inflate it every time the
recipient refreshes — which would unfairly *lower* that donor's
reliability score for no real reason (see Phase 6/7). Fixed by comparing
`match.createdAt.getTime() === match.updatedAt.getTime()` right after the
`upsert` — they're only equal on the instant a row is first created, so
the counter only increments the first time a donor is actually matched to
a given request, not on every re-run.

**A real bug I found while building the frontend, only visible in a
browser:** every backend unit and integration test up to this point used
*separate* users for the recipient and the donor, because that's how the
tests were written — so nothing ever exercised the case where the same
person is both. The first time I actually clicked through the app as one
person — registered, set up a donor profile, then created a blood
request for myself — the matching engine happily matched me to my own
request. Nonsensical in the real world (you're not a candidate donor for
your own need), and not something any existing test would have caught,
since none of them modeled it. Fixed by adding the third hard filter
above. I then had to fix the *tests* too: `bloodMatchingEngine.test.js`'s
fixture helpers previously left `donor.userId` and `request.requesterId`
both `undefined`, which are `===` to each other in JavaScript — every
existing test in that file was accidentally already a "self-match"
without anyone noticing, because nothing asserted on that field before.
Both fixtures now default to distinct ids, and a dedicated test locks in
the new filter.

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

**Two authorization paths onto the same state machine (Phase 9):** back
in Phase 8, `transitionBloodRequestStatus` checked that the caller owned
the request (`request.requesterId`) — fine for recipient-driven
transitions like cancelling. But when a *donor* accepts a match, they need
to drive `DONOR_CONTACTED → ACCEPTED`, and they are never the request's
owner. Rather than weaken the ownership check, `bloodRequestService.js`
now exposes two functions: the public, owner-checked
`transitionBloodRequestStatus` (used by `PUT /:id/status`, for the
recipient), and an internal `applyRequestStatusTransition` with no
ownership check at all — used only by `matchService.js`, which has
already verified a *different* ownership relationship (the donor owns the
`DonorMatch`) before calling it. The state-machine rule itself
(`assertValidTransition`) is enforced identically either way; only the
"who's allowed to trigger this" check differs by caller.

## Notifications

Database-backed only — no SMS, WhatsApp, Firebase, or Socket.io.
`notificationService.js` is deliberately tiny: `createNotification`,
`listNotificationsForUser`, `markNotificationRead` (ownership-checked,
same `assertOwnership` pattern as everything else). The actual
notification-triggering logic lives where the *event* happens —
`matchService.js` — not inside the notification service itself, since the
notification service shouldn't need to know *why* it's being called.

| Event (in `matchService.js`) | Recipient of the notification | Type |
|---|---|---|
| A donor is newly matched | The donor | `MATCH_FOUND` |
| Donors found/contacted for a request (first time) | The recipient | `DONOR_CONTACTED` |
| A donor accepts | The recipient | `DONOR_ACCEPTED` |
| A donor declines | The recipient | `DONOR_DECLINED` |
| Request marked `FULFILLED` | The donor who was `ACCEPTED` | `REQUEST_FULFILLED` |

The `MATCH_FOUND` message is built from the request's own urgency and
blood group — e.g. `"Emergency A+ blood request near you."` — matching
the example phrasing from the spec, using two tiny formatting helpers
(`formatUrgency`, `formatBloodGroup` in `utils/formatters.js`) rather than
hardcoding message strings per blood group.

**Closing a real gap:** `DonorProfile.donationsCompleted` — the field the
Phase 6/7 reliability score has depended on since the matching engine was
built — had never actually been incremented anywhere until this phase.
`rewardDonorOnFulfilled(requestId)` (called from
`bloodRequestController.transitionStatus` only when the new status is
`FULFILLED`) finds the request's `ACCEPTED` `DonorMatch`, increments that
donor's `donationsCompleted`, and sends them the `REQUEST_FULFILLED`
notification. This function lives in `matchService.js`, not
`bloodRequestService.js` — putting it in `bloodRequestService.js` would
require importing from `matchService.js`, which already imports from
`bloodRequestService.js`, creating a circular dependency. Keeping the
"reward the donor" orchestration in the controller, calling into
whichever service owns each piece of data, avoids that.

I verified the entire chain live: donor gets `MATCH_FOUND` the moment
they're matched (message read exactly `"Emergency A+ blood request near
you."`), recipient gets `DONOR_CONTACTED` then `DONOR_ACCEPTED`, marking
the request `FULFILLED` gave the donor a `REQUEST_FULFILLED` notification
*and* bumped `donationsCompleted` from 0 to 1, marking a notification read
worked, and a different user trying to mark someone else's notification
read correctly got `403`.

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

`DonorMatch` extends the same ownership pattern to a different owner
field: accepting/declining a match checks `donorProfile.userId` (the
matched donor), not `requesterId`. See "Request state machine" above for
how the two ownership paths connect to the same underlying state machine.

## REST API reference

| Method & Path | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | — | Create a user, returns `{ user, token }` |
| `POST /api/auth/login` | — | Returns `{ user, token }` |
| `GET /api/auth/me` | required | Current user, via `requireAuth` |
| `POST /api/requests` | required | Creates a `BloodRequest`, caller becomes the owner |
| `GET /api/requests` | required | List all requests (open browsing) |
| `GET /api/requests/:id` | required | One request (open browsing) |
| `PUT /api/requests/:id` | owner only | Update fields — **not** `status` |
| `PUT /api/requests/:id/status` | owner only | The only way to change `status`; validated by the state machine |
| `DELETE /api/requests/:id` | owner only | Cancels (sets `status: CANCELLED`) via the state machine, not a hard delete |
| `GET /api/requests/:id/matches` | owner only | Runs the matching engine, persists `DonorMatch` rows, advances status — see the REST-semantics note above |
| `GET /api/donors/me` | required | The caller's own `DonorProfile` (unsanitized — full record), or `null` if they haven't set one up yet |
| `PUT /api/donors/profile` | required | Create/update the caller's own `DonorProfile` (upsert — self-scoped, no id in the URL) |
| `PUT /api/donors/availability` | required | Toggle the caller's own `isAvailable` |
| `GET /api/donors` | required | Browse donors (sanitized — no exact coordinates); optional `?bloodGroup=`, `?city=` filters; includes `reliabilityScore` |
| `GET /api/donors/:id` | required | One donor's sanitized public profile |
| `GET /api/matches/mine` | required | The caller's own `DonorMatch` rows (as a donor), with request details included; optional `?status=` filter — added in Phase 11 for the Dashboard/Notifications pages |
| `POST /api/matches/:id/accept` | matched donor only | Match → `ACCEPTED`, request → `ACCEPTED`; notifies the recipient |
| `POST /api/matches/:id/decline` | matched donor only | Match → `DECLINED`, request → `MATCHING` (if still awaiting this donor); notifies the recipient |
| `GET /api/notifications` | required | The caller's own notifications, newest first |
| `PUT /api/notifications/:id/read` | owner only | Marks one notification as read |

## Frontend

**Architecture:**
- `api/client.js` — one shared `fetch` wrapper. Every other `api/*.js` file
  is a thin, resource-named set of functions (`register()`, `createRequest()`,
  `acceptMatch()`...) built on top of it, so a page component never calls
  `fetch` directly.
- `context/AuthContext.jsx` — React Context holding `{ user, token }`, with
  `login`/`register`/`logout`. The JWT is persisted to `localStorage` (the
  backend is stateless — Phase 3 — so the *browser* has to remember who's
  logged in across page reloads) and re-validated against
  `GET /api/auth/me` on first load, so a stale/expired token doesn't leave
  the UI stuck pretending someone is logged in.
- `components/ProtectedRoute.jsx` — redirects to `/login` if there's no
  user. This is a **UX** convenience only — the real security boundary is
  still each endpoint's `requireAuth` middleware on the backend; a user
  could bypass this component entirely and still couldn't get real data
  without a valid token.

**Pages:** `Dashboard.jsx` is the most involved — it combines the donor
view (profile summary, reliability score, availability toggle, incoming
`PENDING` matches with Accept/Decline, `ACCEPTED` matches) and the
recipient view (the user's own requests, emergency ones visually
flagged) in one page, since most users will use both roles over time
rather than being permanently "a donor" or "a recipient." `RequestDetails.jsx`
is the second most involved — for the request's owner it exposes "Find
Matching Donors" (calls the matching endpoint), "Mark as Fulfilled," and
"Cancel," each gated by the current `status` so an invalid action never
even renders as a clickable button, on top of the backend's own state
machine rejecting it anyway (defense in depth: the frontend hides invalid
actions for UX, the backend refuses them regardless).

**Verified in a real browser**, not just by reading the code: registered
two separate users (donor + recipient) with Playwright, walked the entire
flow — donor profile → blood request → find matches → donor sees it on
their Dashboard → accepts → recipient marks fulfilled → donor gets a
`REQUEST_FULFILLED` notification — and screenshotted every step. This is
also how the two Phase 11 bugs below were found; neither was visible from
reading the code alone.

**Two real bugs found only by clicking through the running app:**

1. **The self-match bug** — described above in "Donor matching & ranking
   engine." A single test user registering as both donor and recipient
   (the natural thing to do when manually testing) got matched to their
   own request. No backend test had ever modeled one person filling both
   roles.
2. **Backend endpoints that didn't exist yet, discovered while designing
   the pages that needed them** — `GET /api/donors/me` (a donor checking
   their own profile) and `GET /api/matches/mine` (a donor seeing their
   own incoming/accepted matches) were both missing. Every prior phase's
   endpoints existed because the *backend* spec listed them; these two
   existed because the *frontend* genuinely couldn't function without
   them — Dashboard has no way to show "your donor profile" or "requests
   matched to you" otherwise. Both were added deliberately, not
   speculatively: each is used by a specific page built in this same
   phase, not "for later."

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
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:5000
npm run dev
```

Frontend runs at `http://localhost:5173`. With the backend also running,
open it in a browser: register two accounts (one to be the donor, one the
recipient — or just one, to see the Landing page and forms), set up a
donor profile, create a blood request, click "Find Matching Donors."

## Testing

```bash
cd backend
npm test
```

Runs Node's built-in test runner (`node --test`) against
`backend/src/tests/*.test.js`. Auth, blood-request, donor, match, and
notification tests are integration tests — they hit a real Postgres
database through Prisma (using whatever `DATABASE_URL` is in your
`.env`), not a mock. `bloodCompatibility.test.js`, `proximity.test.js`,
`donorReliability.test.js`, `bloodMatchingEngine.test.js`, and
`requestStateMachine.test.js` are pure unit tests — no database involved.
Current coverage (80 tests) includes everything from earlier phases, plus
(Phase 11): `GET /api/donors/me` returning `null` (not a 404) for a user
with no profile yet vs. the full unsanitized record for one who has, and
the self-match hard filter (`isEligibleDonor` rejects a donor matched
against their own request; `rankDonorsForRequest` returns an empty list
for it).

**A testing-hygiene bug, also found by actually re-running things (this
time the test suite, not the app):** every integration test's cleanup
call sat at the *end* of the test body — `const scenario = await
makeScenario(); ...assertions...; await cleanupScenario(scenario)`. The
moment any assertion threw, the function exited early and cleanup never
ran, silently leaving `User`/`DonorProfile`/`BloodRequest` rows behind.
Normally invisible — but `findMatchesForRequest` queries *every*
`DonorProfile` in the table (correct in production), so one failed test
run's leftover donor could inflate another, unrelated test's match count
on the *next* run, cascading into more failures each time. Caught when a
genuinely correct test failed with "expected 1, got 4" right after the
self-match fix above. Fixed by wrapping every test body in
`matchService.test.js` in `try { ... } finally { await
cleanupScenario(scenario) }`, so cleanup runs whether the test passes or
fails.

## Limitations (current phase)

- `requestsReceived` increments once per donor per request (the first time
  they're matched), which is correct, but there's no equivalent tracking
  for "how many times has this donor's phone/email actually been used to
  contact them" — that's out of scope; this app is in-app only.
- If two donors are both `PENDING` on the same request and one accepts,
  the other's `PENDING` match is left dangling rather than being
  auto-declined. Accepting it later correctly fails (`400`, request no
  longer `DONOR_CONTACTED`), but a nicer UX would proactively decline the
  remaining pending matches (and notify those donors) the moment one is
  accepted — not implemented, to keep this phase's scope focused.
- `GET /api/requests/:id/matches` intentionally has a side effect (see the
  REST-semantics note above) — a stricter API would split trigger and
  read into separate endpoints.
- No push/email/SMS delivery — notifications only exist inside the
  database until a frontend polls `GET /api/notifications` and displays
  them. This is intentional (the spec explicitly asks for in-app
  notifications only, not third-party services), not an oversight.
- Notifications don't store a link back to the request/match that
  triggered them (`Notification` only has `message`/`type`, no foreign
  key) — a deliberate scope decision to avoid a schema migration for a
  feature the frontend can approximate: clicking a notification routes
  generically by `type` (donor-facing types → Dashboard, recipient-facing
  types → My Requests) rather than deep-linking the exact request.
- The Dashboard shows only the current user's *own* requests, filtered
  client-side from `GET /api/requests` (which returns everyone's, by
  design — see Authorization above) — fine at this project's scale, but a
  real product would add a `?mine=true` server-side filter instead of
  shipping every user's requests to every client.
- No frontend automated tests yet (no Vitest component tests) — the
  frontend was verified with real, scripted browser sessions
  (Playwright) rather than unit tests; that's how both Phase 11 bugs were
  actually found. Formal frontend test coverage is not currently planned,
  to keep the project's testing effort concentrated on the backend
  business logic where the real engineering risk lives.
- Logout is client-side only (delete the token) — there's no server-side
  token blacklist, so a stolen token remains valid until it expires (7
  days). A production system might add a short-lived access token + refresh
  token pair; out of scope here to keep things explainable.

These are addressed in later phases.
