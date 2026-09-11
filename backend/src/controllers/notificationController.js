import {
  listNotificationsForUser,
  markNotificationRead,
} from '../services/notificationService.js'

export async function list(req, res) {
  const notifications = await listNotificationsForUser(req.user.id)
  res.status(200).json({ notifications })
}

export async function markRead(req, res) {
  try {
    const notification = await markNotificationRead(req.params.id, req.user.id)
    res.status(200).json({ notification })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
