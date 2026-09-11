import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import { upsertDonorProfile } from '../services/donorService.js'
import { createBloodRequest, getBloodRequestById } from '../services/bloodRequestService.js'
import {
  findMatchesForRequest,
  acceptMatch,
  declineMatch,
} from '../services/matchService.js'

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

async function cleanupScenario({ recipient, donorUser, request }) {
  await prisma.donorMatch.deleteMany({ where: { requestId: request.id } })
  await prisma.donorProfile.deleteMany({ where: { userId: donorUser.id } })
  await prisma.bloodRequest.deleteMany({ where: { id: request.id } })
  await prisma.user.deleteMany({ where: { id: { in: [recipient.id, donorUser.id] } } })
}

test('findMatchesForRequest creates a match and moves the request to DONOR_CONTACTED', async () => {
  const scenario = await makeScenario()

  const matches = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].status, 'PENDING')
  assert.equal(matches[0].donorProfile.latitude, undefined) // sanitized

  const updatedRequest = await getBloodRequestById(scenario.request.id)
  assert.equal(updatedRequest.status, 'DONOR_CONTACTED')

  await cleanupScenario(scenario)
})

test('findMatchesForRequest rejects a non-owner', async () => {
  const scenario = await makeScenario()
  const stranger = await makeUser('Stranger')

  await assert.rejects(
    () => findMatchesForRequest(scenario.request.id, stranger.id),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await cleanupScenario(scenario)
  await prisma.user.delete({ where: { id: stranger.id } })
})

test('calling findMatchesForRequest twice does not double-count requestsReceived', async () => {
  const scenario = await makeScenario()

  await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
  await findMatchesForRequest(scenario.request.id, scenario.recipient.id) // status is now DONOR_CONTACTED

  const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
  assert.equal(donor.requestsReceived, 1)

  await cleanupScenario(scenario)
})

test('a donor accepting a match moves the request to ACCEPTED and increments requestsAccepted', async () => {
  const scenario = await makeScenario()
  const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

  const accepted = await acceptMatch(match.id, scenario.donorUser.id)
  assert.equal(accepted.status, 'ACCEPTED')

  const updatedRequest = await getBloodRequestById(scenario.request.id)
  assert.equal(updatedRequest.status, 'ACCEPTED')

  const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
  assert.equal(donor.requestsAccepted, 1)

  await cleanupScenario(scenario)
})

test('a user who is not the matched donor cannot accept the match', async () => {
  const scenario = await makeScenario()
  const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

  // The recipient is a valid logged-in user, but not the donor on this match.
  await assert.rejects(
    () => acceptMatch(match.id, scenario.recipient.id),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await cleanupScenario(scenario)
})

test('accepting an already-accepted match is rejected', async () => {
  const scenario = await makeScenario()
  const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
  await acceptMatch(match.id, scenario.donorUser.id)

  await assert.rejects(
    () => acceptMatch(match.id, scenario.donorUser.id),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )

  await cleanupScenario(scenario)
})

test('a donor declining a match bounces the request back to MATCHING and increments requestsDeclined', async () => {
  const scenario = await makeScenario()
  const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)

  const declined = await declineMatch(match.id, scenario.donorUser.id)
  assert.equal(declined.status, 'DECLINED')

  const updatedRequest = await getBloodRequestById(scenario.request.id)
  assert.equal(updatedRequest.status, 'MATCHING')

  const donor = await prisma.donorProfile.findUnique({ where: { id: scenario.donorProfile.id } })
  assert.equal(donor.requestsDeclined, 1)

  await cleanupScenario(scenario)
})

test('declining an already-declined match is rejected', async () => {
  const scenario = await makeScenario()
  const [match] = await findMatchesForRequest(scenario.request.id, scenario.recipient.id)
  await declineMatch(match.id, scenario.donorUser.id)

  await assert.rejects(
    () => declineMatch(match.id, scenario.donorUser.id),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )

  await cleanupScenario(scenario)
})

after(async () => {
  await prisma.$disconnect()
})
