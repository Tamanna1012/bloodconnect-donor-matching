import { get, post, put, del } from './client'

export function createRequest(data, token) {
  return post('/api/requests', data, token)
}

export function listRequests(token) {
  return get('/api/requests', token)
}

export function getRequest(id, token) {
  return get(`/api/requests/${id}`, token)
}

export function updateRequest(id, data, token) {
  return put(`/api/requests/${id}`, data, token)
}

export function transitionRequestStatus(id, status, token) {
  return put(`/api/requests/${id}/status`, { status }, token)
}

export function cancelRequest(id, token) {
  return del(`/api/requests/${id}`, token)
}

export function getMatchesForRequest(id, token) {
  return get(`/api/requests/${id}/matches`, token)
}
