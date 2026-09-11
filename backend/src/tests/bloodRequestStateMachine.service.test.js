import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import {
  createBloodRequest,
  updateBloodRequest,
  transitionBloodRequestStatus,
  cancelBloodRequest,
} from '../services/bloodRequestService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function makeUser(name) {
  const { user } = await registerUser({ name, email: uniqueEmail(), password: 'secret123' })
  return user
}

test('updateBloodRequest rejects any attempt to change status directly', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'NORMAL',
  })

  await assert.rejects(
    () => updateBloodRequest(request.id, owner.id, { status: 'FULFILLED' }),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('transitionBloodRequestStatus walks the full valid happy path', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'NORMAL',
  })

  let updated = await transitionBloodRequestStatus(request.id, owner.id, 'MATCHING')
  assert.equal(updated.status, 'MATCHING')

  updated = await transitionBloodRequestStatus(request.id, owner.id, 'DONOR_CONTACTED')
  assert.equal(updated.status, 'DONOR_CONTACTED')

  updated = await transitionBloodRequestStatus(request.id, owner.id, 'ACCEPTED')
  assert.equal(updated.status, 'ACCEPTED')

  updated = await transitionBloodRequestStatus(request.id, owner.id, 'FULFILLED')
  assert.equal(updated.status, 'FULFILLED')

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('transitionBloodRequestStatus rejects an invalid jump (OPEN -> FULFILLED)', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'NORMAL',
  })

  await assert.rejects(
    () => transitionBloodRequestStatus(request.id, owner.id, 'FULFILLED'),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('a non-owner cannot transition another user\'s request, even a valid transition', async () => {
  const owner = await makeUser('Owner')
  const attacker = await makeUser('Attacker')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'NORMAL',
  })

  await assert.rejects(
    () => transitionBloodRequestStatus(request.id, attacker.id, 'MATCHING'),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, attacker.id] } } })
})

test('cancelling a FULFILLED request is rejected, not silently applied (the Phase 4 bug fix)', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 1,
    city: 'Chennai',
    urgency: 'NORMAL',
  })
  // Drive it straight to FULFILLED via direct writes to simulate history
  // without re-testing the whole happy path here.
  await prisma.bloodRequest.update({ where: { id: request.id }, data: { status: 'FULFILLED' } })

  await assert.rejects(
    () => cancelBloodRequest(request.id, owner.id),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )

  const stillFulfilled = await prisma.bloodRequest.findUnique({ where: { id: request.id } })
  assert.equal(stillFulfilled.status, 'FULFILLED')

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

after(async () => {
  await prisma.$disconnect()
})
