import prisma from '../utils/prisma.js'
import { assertFound, assertOwnership, httpError } from '../utils/httpErrors.js'
import { rankDonorsForRequest } from './bloodMatchingEngine.js'
import {
  getBloodRequestById,
  applyRequestStatusTransition,
} from './bloodRequestService.js'
import { sanitizeDonorProfile } from './donorService.js'
import { createNotification, NOTIFICATION_TYPES } from './notificationService.js'
import { formatBloodGroup, formatUrgency } from '../utils/formatters.js'

/**
 * Runs the matching engine for a request and persists the results as
 * DonorMatch rows, then advances the request's status.
 *
 * NOTE on REST semantics: this is called from a GET route (per the spec's
 * endpoint list), even though it writes to the database. A stricter REST
 * design would split this into a POST (trigger) and a separate read-only
 * GET (list existing matches). Implemented this way to match the given
 * API shape; the trade-off is documented here and in the README.
 */
const SEARCHABLE_STATUSES = ['OPEN', 'MATCHING']

export async function findMatchesForRequest(requestId, requestingUserId) {
  const request = await getBloodRequestById(requestId)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')

  // Once a donor has been contacted (or the request moved further), there
  // is nothing new to search for -- just return whatever matches already
  // exist instead of re-running (and having the engine correctly reject
  // re-matching a non-searching request).
  if (!SEARCHABLE_STATUSES.includes(request.status)) {
    return listMatchesForRequest(requestId, requestingUserId)
  }

  let currentStatus = request.status
  if (currentStatus === 'OPEN') {
    await applyRequestStatusTransition(requestId, 'MATCHING')
    currentStatus = 'MATCHING'
  }

  const donorProfiles = await prisma.donorProfile.findMany()
  const ranked = rankDonorsForRequest({ ...request, status: currentStatus }, donorProfiles)

  const persistedMatches = []
  const newlyMatchedDonorProfileIds = []

  for (const entry of ranked) {
    const match = await prisma.donorMatch.upsert({
      where: {
        requestId_donorProfileId: {
          requestId: request.id,
          donorProfileId: entry.donorProfile.id,
        },
      },
      create: {
        requestId: request.id,
        donorProfileId: entry.donorProfile.id,
        score: entry.totalScore,
        status: 'PENDING',
      },
      update: { score: entry.totalScore },
      include: { donorProfile: true },
    })

    // A fresh upsert sets createdAt and updatedAt to the exact same
    // instant, so comparing them tells us "was this row just created?"
    // without a separate lookup -- used to only count a donor as
    // "contacted" (requestsReceived++) the first time, not on every
    // re-run of the matching engine for the same request.
    const wasNewlyCreated = match.createdAt.getTime() === match.updatedAt.getTime()
    if (wasNewlyCreated) newlyMatchedDonorProfileIds.push(match.donorProfileId)

    persistedMatches.push(match)
  }

  if (newlyMatchedDonorProfileIds.length > 0) {
    await prisma.donorProfile.updateMany({
      where: { id: { in: newlyMatchedDonorProfileIds } },
      data: { requestsReceived: { increment: 1 } },
    })
  }

  if (newlyMatchedDonorProfileIds.length > 0) {
    const matchMessage =
      `${formatUrgency(request.urgency)} ${formatBloodGroup(request.bloodGroup)} ` +
      `blood request near you.`

    const newlyMatched = persistedMatches.filter((m) =>
      newlyMatchedDonorProfileIds.includes(m.donorProfileId),
    )
    for (const match of newlyMatched) {
      await createNotification(match.donorProfile.userId, NOTIFICATION_TYPES.MATCH_FOUND, matchMessage)
    }
  }

  if (persistedMatches.length > 0 && currentStatus !== 'DONOR_CONTACTED') {
    await applyRequestStatusTransition(requestId, 'DONOR_CONTACTED')
    await createNotification(
      request.requesterId,
      NOTIFICATION_TYPES.DONOR_CONTACTED,
      'We found and contacted a matching donor for your request.',
    )
  }

  return persistedMatches.map((match) => ({
    ...match,
    donorProfile: sanitizeDonorProfile(match.donorProfile),
  }))
}

// A donor's own view of the requests they've been matched to. Without
// this, a donor has no way to discover their own match ids -- every other
// match endpoint requires already knowing one. Necessary for the
// Dashboard ("incoming requests") and Notifications pages, not built
// speculatively.
export async function listMyMatches(donorUserId, statusFilter) {
  const donorProfile = await prisma.donorProfile.findUnique({ where: { userId: donorUserId } })
  if (!donorProfile) return []

  const where = { donorProfileId: donorProfile.id }
  if (statusFilter) where.status = statusFilter

  return prisma.donorMatch.findMany({
    where,
    include: { request: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listMatchesForRequest(requestId, requestingUserId) {
  const request = await getBloodRequestById(requestId)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')

  const matches = await prisma.donorMatch.findMany({
    where: { requestId },
    include: { donorProfile: true },
    orderBy: { score: 'desc' },
  })

  return matches.map((match) => ({
    ...match,
    donorProfile: sanitizeDonorProfile(match.donorProfile),
  }))
}

export async function getDonorMatchById(id) {
  const match = await prisma.donorMatch.findUnique({
    where: { id },
    include: { donorProfile: true, request: true },
  })
  assertFound(match, 'Donor match')
  return match
}

export async function acceptMatch(matchId, donorUserId) {
  const match = await getDonorMatchById(matchId)
  assertOwnership(match.donorProfile.userId, donorUserId, 'donor match')

  if (match.status !== 'PENDING') {
    throw httpError(400, `This match has already been ${match.status.toLowerCase()}`)
  }
  if (match.request.status !== 'DONOR_CONTACTED') {
    throw httpError(400, 'This request is no longer awaiting a donor response')
  }

  const updatedMatch = await prisma.donorMatch.update({
    where: { id: matchId },
    data: { status: 'ACCEPTED' },
  })

  await applyRequestStatusTransition(match.requestId, 'ACCEPTED')
  await prisma.donorProfile.update({
    where: { id: match.donorProfileId },
    data: { requestsAccepted: { increment: 1 } },
  })

  await createNotification(
    match.request.requesterId,
    NOTIFICATION_TYPES.DONOR_ACCEPTED,
    'A donor has accepted your blood request.',
  )
  return updatedMatch
}

export async function declineMatch(matchId, donorUserId) {
  const match = await getDonorMatchById(matchId)
  assertOwnership(match.donorProfile.userId, donorUserId, 'donor match')

  if (match.status !== 'PENDING') {
    throw httpError(400, `This match has already been ${match.status.toLowerCase()}`)
  }

  const updatedMatch = await prisma.donorMatch.update({
    where: { id: matchId },
    data: { status: 'DECLINED' },
  })

  await prisma.donorProfile.update({
    where: { id: match.donorProfileId },
    data: { requestsDeclined: { increment: 1 } },
  })

  // Only bounce the request back to MATCHING if it's still waiting on
  // THIS donor's response -- if another donor already accepted (request
  // moved past DONOR_CONTACTED), a late decline shouldn't corrupt that.
  if (match.request.status === 'DONOR_CONTACTED') {
    await applyRequestStatusTransition(match.requestId, 'MATCHING')
  }

  await createNotification(
    match.request.requesterId,
    NOTIFICATION_TYPES.DONOR_DECLINED,
    "A donor declined your blood request. We're searching for another match.",
  )
  return updatedMatch
}

// Called by bloodRequestController after a request successfully
// transitions to FULFILLED. Lives here (not in bloodRequestService) to
// avoid a circular import -- matchService already depends on
// bloodRequestService, not the other way around.
export async function rewardDonorOnFulfilled(requestId) {
  const acceptedMatch = await prisma.donorMatch.findFirst({
    where: { requestId, status: 'ACCEPTED' },
  })
  if (!acceptedMatch) return null

  const donorProfile = await prisma.donorProfile.update({
    where: { id: acceptedMatch.donorProfileId },
    data: { donationsCompleted: { increment: 1 } },
  })

  await createNotification(
    donorProfile.userId,
    NOTIFICATION_TYPES.REQUEST_FULFILLED,
    'Thank you — your donation was recorded as fulfilled.',
  )

  return donorProfile
}
