import {
  listNotificationsForUser,
  markNotificationRead,
} from '../services/notificationService.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const list = asyncHandler(async (req, res) => {
  const notifications = await listNotificationsForUser(req.user.id)
  res.status(200).json({ notifications })
})

export const markRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.params.id, req.user.id)
  res.status(200).json({ notification })
})
