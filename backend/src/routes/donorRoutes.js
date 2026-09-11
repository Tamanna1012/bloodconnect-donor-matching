import { Router } from 'express'
import {
  getMine,
  upsertProfile,
  updateAvailability,
  list,
  getOne,
} from '../controllers/donorController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.use(requireAuth)

router.get('/', list)
router.get('/me', getMine) // must come before /:id, or "me" is read as an id
router.get('/:id', getOne)
router.put('/profile', upsertProfile)
router.put('/availability', updateAvailability)

export default router
