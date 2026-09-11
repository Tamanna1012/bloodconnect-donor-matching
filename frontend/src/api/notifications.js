import { get, put } from './client'

export function listNotifications(token) {
  return get('/api/notifications', token)
}

export function markNotificationRead(id, token) {
  return put(`/api/notifications/${id}/read`, {}, token)
}
