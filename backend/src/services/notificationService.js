import prisma from '../utils/prisma.js'
import { assertFound, assertOwnership } from '../utils/httpErrors.js'

export const NOTIFICATION_TYPES = {
  MATCH_FOUND: 'MATCH_FOUND', // to a donor: a request matched them
  DONOR_CONTACTED: 'DONOR_CONTACTED', // to a recipient: donors were found/contacted
  DONOR_ACCEPTED: 'DONOR_ACCEPTED', // to a recipient
  DONOR_DECLINED: 'DONOR_DECLINED', // to a recipient
  REQUEST_FULFILLED: 'REQUEST_FULFILLED', // to the donor who fulfilled it
}

export async function createNotification(userId, type, message) {
  return prisma.notification.create({
    data: { userId, type, message },
  })
}

export async function listNotificationsForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function markNotificationRead(notificationId, requestingUserId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } })
  assertFound(notification, 'Notification')
  assertOwnership(notification.userId, requestingUserId, 'notification')

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })
}
