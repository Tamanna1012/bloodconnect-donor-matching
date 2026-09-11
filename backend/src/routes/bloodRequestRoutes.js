import { Router } from 'express'
import {
  create,
  list,
  getOne,
  update,
  transitionStatus,
  remove,
} from '../controllers/bloodRequestController.js'
import { findMatches } from '../controllers/matchController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Every blood-request route requires a logged-in user.
// Ownership (only the creator can edit/cancel) is enforced inside the
// service layer, not here — see bloodRequestService.js.
router.use(requireAuth)

router.post('/', create)
router.get('/', list)
router.get('/:id', getOne)
router.get('/:id/matches', findMatches)
router.put('/:id', update)
router.put('/:id/status', transitionStatus)
router.delete('/:id', remove)

export default router
