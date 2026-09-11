import { registerUser, loginUser } from '../services/authService.js'
import { isValidEmail, isValidPassword } from '../utils/validators.js'

export async function register(req, res) {
  const { name, email, password, phone, city } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' })
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' })
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    const { user, token } = await registerUser({ name, email, password, phone, city })
    res.status(201).json({ user, token })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const { user, token } = await loginUser({ email, password })
    res.status(200).json({ user, token })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function me(req, res) {
  res.status(200).json({ user: req.user })
}
