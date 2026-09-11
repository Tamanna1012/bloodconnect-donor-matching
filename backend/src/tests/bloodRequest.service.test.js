import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import {
  createBloodRequest,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest,
} from '../services/bloodRequestService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function makeUser(name) {
  const { user } = await registerUser({ name, email: uniqueEmail(), password: 'secret123' })
  return user
}

test('a user can create and read their own blood request', async () => {
  const owner = await makeUser('Owner')

  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_NEG',
    units: 2,
    city: 'Chennai',
    urgency: 'URGENT',
  })

  assert.equal(request.requesterId, owner.id)
  assert.equal(request.status, 'OPEN')

  const fetched = await getBloodRequestById(request.id)
  assert.equal(fetched.id, request.id)

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('the owner can update their own blood request', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'A_POS',
    units: 1,
    city: 'Delhi',
    urgency: 'NORMAL',
  })

  const updated = await updateBloodRequest(request.id, owner.id, { units: 4 })
  assert.equal(updated.units, 4)

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('a non-owner cannot update another user\'s blood request (IDOR check)', async () => {
  const owner = await makeUser('Owner')
  const attacker = await makeUser('Attacker')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'AB_NEG',
    units: 2,
    city: 'Pune',
    urgency: 'EMERGENCY',
  })

  await assert.rejects(
    () => updateBloodRequest(request.id, attacker.id, { units: 99 }),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, attacker.id] } } })
})

test('a non-owner cannot cancel another user\'s blood request', async () => {
  const owner = await makeUser('Owner')
  const attacker = await makeUser('Attacker')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'B_NEG',
    units: 1,
    city: 'Kolkata',
    urgency: 'NORMAL',
  })

  await assert.rejects(
    () => cancelBloodRequest(request.id, attacker.id),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, attacker.id] } } })
})

test('the owner can cancel their own request, which sets status to CANCELLED', async () => {
  const owner = await makeUser('Owner')
  const request = await createBloodRequest(owner.id, {
    bloodGroup: 'O_POS',
    units: 3,
    city: 'Hyderabad',
    urgency: 'URGENT',
  })

  const cancelled = await cancelBloodRequest(request.id, owner.id)
  assert.equal(cancelled.status, 'CANCELLED')

  await prisma.bloodRequest.delete({ where: { id: request.id } })
  await prisma.user.delete({ where: { id: owner.id } })
})

test('getBloodRequestById throws 404 for a non-existent id', async () => {
  await assert.rejects(
    () => getBloodRequestById('00000000-0000-0000-0000-000000000000'),
    (err) => {
      assert.equal(err.statusCode, 404)
      return true
    },
  )
})

after(async () => {
  await prisma.$disconnect()
})
