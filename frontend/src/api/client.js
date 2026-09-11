const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Every request goes through this one function. It attaches the JWT (if
// we have one), parses the JSON response, and throws a normal JS Error
// with the backend's message on failure -- so calling code can just
// `try { await apiRequest(...) } catch (err) { setError(err.message) }`
// instead of manually checking `response.ok` everywhere.
async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.')
  }

  return data
}

export function get(path, token) {
  return apiRequest(path, { token })
}

export function post(path, body, token) {
  return apiRequest(path, { method: 'POST', body, token })
}

export function put(path, body, token) {
  return apiRequest(path, { method: 'PUT', body, token })
}

export function del(path, token) {
  return apiRequest(path, { method: 'DELETE', token })
}
