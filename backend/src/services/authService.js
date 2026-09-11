import bcrypt from 'bcrypt'
import prisma from '../utils/prisma.js'
import { signToken } from '../utils/jwt.js'

const SALT_ROUNDS = 10

// Strip the password hash before a user object ever leaves this layer.
export function sanitizeUser(user) {
  const { password, ...safeUser } = user
  return safeUser
}

export async function registerUser({ name, email, password, phone, city }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const error = new Error('Email is already registered')
    error.statusCode = 409
    throw error
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: { name, email, password: passwordHash, phone, city },
  })

  const token = signToken({ userId: user.id })

  return { user: sanitizeUser(user), token }
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } })

  // Same error for "no such user" and "wrong password" on purpose —
  // this stops an attacker from using the login form to discover
  // which emails are registered.
  const invalidCredentials = () => {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }

  if (!user) invalidCredentials()

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) invalidCredentials()

  const token = signToken({ userId: user.id })

  return { user: sanitizeUser(user), token }
}
