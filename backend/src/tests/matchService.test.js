import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import { upsertDonorProfile } from '../services/donorService.js'
import {
  createBloodRequest,
  getBloodRequestById,
  transitionBloodRequestStatus,
} from '../services/bloodRequestService.js'
import {
  findMatchesForRequest,
  listMyMatches,
  acceptMatch,
  declineMatch,
  rewardDonorOnFulfilled,
} from '../services/matchService.js'
import { NOTIFICATION_TYPES } from '../services/notificationService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function makeUser(name) {
  const { user } = await registerUser({ name, email: uniqueEmail(), password: 'secret123' })
  return user
}

// Sets up a recipient with an OPEN request, and one eligible donor
// (compatible blood group, available) so findMatchesForRequest has
// exactly one candidate to work with.
async function makeScenario() {
  const recipient = await makeUser('Recipient')
  const donorUser = await makeUser('Donor')
  const donorProfile = await upsertDonorProfile(donorUser.id, {
    bloodGroup: 'O_NEG',
    city: 'Chennai',
  })
  const request = await createBloodRequest(recipient.id, {
    bloodGroup: 'A_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'URGENT',
  })
  return { recipient, donorUser, donorProfile, request }
}

// IMPORTANT: every test below wraps its body in try/finally and calls
// this in the finally block. findMatchesForRequest queries ALL donor
// profiles in the database (correct in production -- you want to search
// every donor), which means a leftover profile from a test that threw
// before cleaning up can silently inflate match counts in a LATER,
// unrelated test. This was a real bug caught by running the suite twice:
// the first run's assertion failure left data behind, which then broke a
// different, otherwise-correct test on the next run.
async function cleanupScenario({ recipient, donorUser, request }) {
  await prisma.notification.deleteMany({
    where: { userId: { in: [recipient.id, donorUser.id] } },
  })
  await prisma.donorMatch.deleteMany({ where: { requestId: request.id } })
  await prisma.donorProfile.deleteMany({ where: { userId: donorUser.id } })
  await prisma.bloodRequest.deleteMany({ where: { id: request.id } })
  await prisma.user.deleteMany({ where: { id: { in: [recipient.id, donorUser.id] } } })
}

test('findMatchesForRequest creates a match and moves the request to DONOR_CONTACTED', async () => {
  const scenario = await makeScenario()
  try {
    const matches = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].status, 'PENDING')
    assert.equal(matches[0].donorProfile.latitude, undefined) // sanitized

    const updatedRequest = await getBloodRequestById(scenario.request.id)
    assert.equal(updatedRequest.status, 'DONOR_CONTACTED')
  } finally {
    await cleanupScenario(scenario)
  }
})

test('findMatchesForRequest rejects a non-owner', async () => {
  const scenario = await makeScenario()
  const stranger = await makeUser('Stranger')
  try {
    await assert.rejects(
      () => findMatchesForRequest(scenario.request.id, stranger.id),
      (err) => {
        assert.equal(err.statusCode, 403)
        return true
      },
    )
  } finally {
    await cleanupScenario(scenario)
    await prisma.user.delete({ where: { id: stranger.id } })
  }
})

test('calling findMatchesForRequest twice does not double-count requestsReceived', async () => {
  const scenario = await makeScenario()
  try {
    await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await findMatchesForRequest(scenario.request.id, scenario.recipient.id) // status is now DONOR_CONTACTED

    const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
    assert.equal(donor.requestsReceived, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('a donor accepting a match moves the request to ACCEPTED and increments requestsAccepted', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

    const accepted = await acceptMatch(match.id, scenario.donorUser.id)
    assert.equal(accepted.status, 'ACCEPTED')

    const updatedRequest = await getBloodRequestById(scenario.request.id)
    assert.equal(updatedRequest.status, 'ACCEPTED')

    const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
    assert.equal(donor.requestsAccepted, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('a user who is not the matched donor cannot accept the match', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

    // The recipient is a valid logged-in user, but not the donor on this match.
    await assert.rejects(
      () => acceptMatch(match.id, scenario.recipient.id),
      (err) => {
        assert.equal(err.statusCode, 403)
        return true
      },
    )
  } finally {
    await cleanupScenario(scenario)
  }
})

test('accepting an already-accepted match is rejected', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await acceptMatch(match.id, scenario.donorUser.id)

    await assert.rejects(
      () => acceptMatch(match.id, scenario.donorUser.id),
      (err) => {
        assert.equal(err.statusCode, 400)
        return true
      },
    )
  } finally {
    await cleanupScenario(scenario)
  }
})

test('a donor declining a match bounces the request back to MATCHING and increments requestsDeclined', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

    const declined = await declineMatch(match.id, scenario.donorUser.id)
    assert.equal(declined.status, 'DECLINED')

    const updatedRequest = await getBloodRequestById(scenario.request.id)
    assert.equal(updatedRequest.status, 'MATCHING')

    const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
    assert.equal(donor.requestsDeclined, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('declining an already-declined match is rejected', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await declineMatch(match.id, scenario.donorUser.id)

    await assert.rejects(
      () => declineMatch(match.id, scenario.donorUser.id),
      (err) => {
        assert.equal(err.statusCode, 400)
        return true
      },
    )
  } finally {
    await cleanupScenario(scenario)
  }
})

test('findMatchesForRequest notifies the matched donor and the recipient', async () => {
  const scenario = await makeScenario()
  try {
    await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

    const donorNotifications = await prisma.notification.findMany({
      where: { userId: scenario.donorUser.id },
    })
    assert.equal(donorNotifications.length, 1)
    assert.equal(donorNotifications[0].type, NOTIFICATION_TYPES.MATCH_FOUND)

    const recipientNotifications = await prisma.notification.findMany({
      where: { userId: scenario.recipient.id },
    })
    assert.equal(recipientNotifications.length, 1)
    assert.equal(recipientNotifications[0].type, NOTIFICATION_TYPES.DONOR_CONTACTED)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('accepting a match notifies the recipient with DONOR_ACCEPTED', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await acceptMatch(match.id, scenario.donorUser.id)

    const notifications = await prisma.notification.findMany({
      where: { userId: scenario.recipient.id, type: NOTIFICATION_TYPES.DONOR_ACCEPTED },
    })
    assert.equal(notifications.length, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('declining a match notifies the recipient with DONOR_DECLINED', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await declineMatch(match.id, scenario.donorUser.id)

    const notifications = await prisma.notification.findMany({
      where: { userId: scenario.recipient.id, type: NOTIFICATION_TYPES.DONOR_DECLINED },
    })
    assert.equal(notifications.length, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('rewardDonorOnFulfilled increments donationsCompleted and notifies the donor', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
    await acceptMatch(match.id, scenario.donorUser.id)
    await transitionBloodRequestStatus(scenario.request.id, scenario.recipient.id, 'FULFILLED')

    await rewardDonorOnFulfilled(scenario.request.id)

    const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
    assert.equal(donor.donationsCompleted, 1)

    const notifications = await prisma.notification.findMany({
      where: { userId: scenario.donorUser.id, type: NOTIFICATION_TYPES.REQUEST_FULFILLED },
    })
    assert.equal(notifications.length, 1)
  } finally {
    await cleanupScenario(scenario)
  }
})

test('listMyMatches returns a donor\'s own matches, optionally filtered by status', async () => {
  const scenario = await makeScenario()
  try {
    const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

    const allMine = await listMyMatches(scenario.donorUser.id)
    assert.equal(allMine.length, 1)
    assert.equal(allMine[0].id, match.id)
    assert.equal(allMine[0].request.id, scenario.request.id) // includes request details

    const pendingOnly = await listMyMatches(scenario.donorUser.id, 'PENDING')
    assert.equal(pendingOnly.length, 1)

    await acceptMatch(match.id, scenario.donorUser.id)
    const stillPending = await listMyMatches(scenario.donorUser.id, 'PENDING')
    assert.equal(stillPending.length, 0) // no longer pending, it's ACCEPTED now
  } finally {
    await cleanupScenario(scenario)
  }
})

test('listMyMatches returns an empty array for a user with no donor profile', async () => {
  const user = await makeUser('No Profile')
  try {
    const matches = await listMyMatches(user.id)
    assert.deepEqual(matches, [])
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
})

after(async () => {
  await prisma.$disconnect()
})
