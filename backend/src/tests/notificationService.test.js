import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser } from '../services/authService.js'
import {
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
  NOTIFICATION_TYPES,
} from '../services/notificationService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function makeUser(name) {
  const { user } = await registerUser({ name, email: uniqueEmail(), password: 'secret123' })
  return user
}

test('createNotification + listNotificationsForUser, newest first', async () => {
  const user = await makeUser('User')

  const first = await createNotification(user.id, NOTIFICATION_TYPES.MATCH_FOUND, 'First message')
  const second = await createNotification(user.id, NOTIFICATION_TYPES.DONOR_ACCEPTED, 'Second message')

  const notifications = await listNotificationsForUser(user.id)
  assert.equal(notifications.length, 2)
  assert.equal(notifications[0].id, second.id) // newest first
  assert.equal(notifications[1].id, first.id)
  assert.equal(notifications[0].isRead, false)

  await prisma.notification.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
})

test('markNotificationRead sets isRead to true', async () => {
  const user = await makeUser('User')
  const notification = await createNotification(user.id, NOTIFICATION_TYPES.MATCH_FOUND, 'Test')

  const updated = await markNotificationRead(notification.id, user.id)
  assert.equal(updated.isRead, true)

  await prisma.notification.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
})

test('a user cannot mark another user\'s notification as read', async () => {
  const owner = await makeUser('Owner')
  const stranger = await makeUser('Stranger')
  const notification = await createNotification(owner.id, NOTIFICATION_TYPES.MATCH_FOUND, 'Test')

  await assert.rejects(
    () => markNotificationRead(notification.id, stranger.id),
    (err) => {
      assert.equal(err.statusCode, 403)
      return true
    },
  )

  await prisma.notification.deleteMany({ where: { userId: owner.id } })
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } })
})

test('markNotificationRead throws 404 for a non-existent notification', async () => {
  await assert.rejects(
    () => markNotificationRead('00000000-0000-0000-0000-000000000000', 'irrelevant'),
    (err) => {
      assert.equal(err.statusCode, 404)
      return true
    },
  )
})

after(async () => {
  await prisma.$disconnect()
})
