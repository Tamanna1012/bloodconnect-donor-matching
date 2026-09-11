import { Router } from 'express'
import {
  upsertProfile,
  updateAvailability,
  list,
  getOne,
} from '../controllers/donorController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', list)
router.get('/:id', getOne)
router.put('/profile', upsertProfile)
router.put('/availability', updateAvailability)

export default router
