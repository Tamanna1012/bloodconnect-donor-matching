import { Router } from 'express'
import {
  create,
  list,
  getOne,
  update,
  remove,
} from '../controllers/bloodRequestController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Every blood-request route requires a logged-in user.
// Ownership (only the creator can edit/cancel) is enforced inside the
// service layer, not here — see bloodRequestService.js.
router.use(requireAuth)

router.post('/', create)
router.get('/', list)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
