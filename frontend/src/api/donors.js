import { get, put } from './client'

export function getMyDonorProfile(token) {
  return get('/api/donors/me', token)
}

export function upsertDonorProfile(data, token) {
  return put('/api/donors/profile', data, token)
}

export function setAvailability(isAvailable, token) {
  return put('/api/donors/availability', { isAvailable }, token)
}

export function listDonors(filters, token) {
  const params = new URLSearchParams(filters).toString()
  return get(`/api/donors${params ? `?${params}` : ''}`, token)
}
