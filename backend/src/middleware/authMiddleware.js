import { verifyToken } from '../utils/jwt.js'
import prisma from '../utils/prisma.js'
import { sanitizeUser } from '../services/authService.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' })
    }

    req.user = sanitizeUser(user)
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
