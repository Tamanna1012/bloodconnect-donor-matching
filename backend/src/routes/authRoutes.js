import { Router } from 'express'
import { register, login, me } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { authRateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.post('/register', authRateLimiter, register)
router.post('/login', authRateLimiter, login)
router.get('/me', requireAuth, me)

export default router
