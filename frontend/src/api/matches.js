import { get, post } from './client'

export function listMyMatches(status, token) {
  const query = status ? `?status=${status}` : ''
  return get(`/api/matches/mine${query}`, token)
}

export function acceptMatch(id, token) {
  return post(`/api/matches/${id}/accept`, {}, token)
}

export function declineMatch(id, token) {
  return post(`/api/matches/${id}/decline`, {}, token)
}
