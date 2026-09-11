import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import {
  upsertDonorProfile,
  setDonorAvailability,
  listDonorProfiles,
  getDonorProfileById,
} from '../services/donorService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function makeUser(name) {
  const { user } = await registerUser({ name, email: uniqueEmail(), password: 'secret123' })
  return user
}

async function cleanup(userId) {
  await prisma.donorProfile.deleteMany({ where: { userId } })
  await prisma.user.delete({ where: { id: userId } })
}

test('upsertDonorProfile creates a profile, then updates the same profile on a second call', async () => {
  const user = await makeUser('Donor')

  const created = await upsertDonorProfile(user.id, { bloodGroup: 'O_NEG', city: 'Chennai' })
  assert.equal(created.bloodGroup, 'O_NEG')
  assert.equal(created.userId, user.id)

  const updated = await upsertDonorProfile(user.id, { bloodGroup: 'A_POS', city: 'Mumbai' })
  assert.equal(updated.id, created.id) // same row, not a duplicate
  assert.equal(updated.bloodGroup, 'A_POS')
  assert.equal(updated.city, 'Mumbai')

  await cleanup(user.id)
})

test('setDonorAvailability toggles isAvailable', async () => {
  const user = await makeUser('Donor')
  await upsertDonorProfile(user.id, { bloodGroup: 'O_NEG', city: 'Chennai' })

  const updated = await setDonorAvailability(user.id, false)
  assert.equal(updated.isAvailable, false)

  await cleanup(user.id)
})

test('listDonorProfiles never exposes exact latitude/longitude', async () => {
  const user = await makeUser('Donor')
  await upsertDonorProfile(user.id, { bloodGroup: 'O_NEG', city: 'Chennai', latitude: 13.08, longitude: 80.27 })

  const donors = await listDonorProfiles({})
  const mine = donors.find((d) => d.userId === user.id)

  assert.ok(mine)
  assert.equal(mine.latitude, undefined)
  assert.equal(mine.longitude, undefined)
  assert.equal(mine.donorName, 'Donor')

  await cleanup(user.id)
})

test('listDonorProfiles filters by bloodGroup', async () => {
  const userA = await makeUser('Donor A')
  const userB = await makeUser('Donor B')
  await upsertDonorProfile(userA.id, { bloodGroup: 'AB_NEG', city: 'Delhi' })
  await upsertDonorProfile(userB.id, { bloodGroup: 'O_POS', city: 'Delhi' })

  const filtered = await listDonorProfiles({ bloodGroup: 'AB_NEG' })
  assert.ok(filtered.every((d) => d.bloodGroup === 'AB_NEG'))
  assert.ok(filtered.some((d) => d.userId === userA.id))
  assert.ok(!filtered.some((d) => d.userId === userB.id))

  await cleanup(userA.id)
  await cleanup(userB.id)
})

test('getDonorProfileById throws 404 for a non-existent id', async () => {
  await assert.rejects(
    () => getDonorProfileById('00000000-0000-0000-0000-000000000000'),
    (err) => {
      assert.equal(err.statusCode, 404)
      return true
    },
  )
})

after(async () => {
  await prisma.$disconnect()
})
