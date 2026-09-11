import { Router } from 'express'
import { list, markRead } from '../controllers/notificationController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', list)
router.put('/:id/read', markRead)

export default router
