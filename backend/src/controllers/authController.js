import { registerUser, loginUser } from '../services/authService.js'
import { isValidEmail, isValidPassword } from '../utils/validators.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const register = asyncHandler(async (req, res) => {
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

  const { user, token } = await registerUser({ name, email, password, phone, city })
  res.status(201).json({ user, token })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const { user, token } = await loginUser({ email, password })
  res.status(200).json({ user, token })
})

export const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: req.user })
})
