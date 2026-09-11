import { get, post } from './client'

export function register(data) {
  return post('/api/auth/register', data)
}

export function login(data) {
  return post('/api/auth/login', data)
}

export function getMe(token) {
  return get('/api/auth/me', token)
}
