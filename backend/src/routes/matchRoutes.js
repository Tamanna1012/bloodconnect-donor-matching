import { Router } from 'express'
import { accept, decline } from '../controllers/matchController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

router.post('/:id/accept', accept)
router.post('/:id/decline', decline)

export default router
