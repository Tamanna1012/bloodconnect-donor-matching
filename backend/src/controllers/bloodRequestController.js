import {
  createBloodRequest,
  listBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest,
  transitionBloodRequestStatus,
} from '../services/bloodRequestService.js'
import { REQUEST_STATE_TRANSITIONS } from '../services/requestStateMachine.js'
import { rewardDonorOnFulfilled } from '../services/matchService.js'
import {
  isValidBloodGroup,
  isValidUrgency,
  isPositiveInteger,
} from '../utils/validators.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

function validateCreatePayload(body) {
  if (!body.bloodGroup || !isValidBloodGroup(body.bloodGroup)) {
    return 'A valid bloodGroup is required'
  }
  if (!isPositiveInteger(body.units)) {
    return 'units must be a positive integer'
  }
  if (!body.city) {
    return 'city is required'
  }
  if (body.urgency && !isValidUrgency(body.urgency)) {
    return 'Invalid urgency level'
  }
  return null
}

export const create = asyncHandler(async (req, res) => {
  const validationError = validateCreatePayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const request = await createBloodRequest(req.user.id, req.body)
  res.status(201).json({ request })
})

export const list = asyncHandler(async (req, res) => {
  const requests = await listBloodRequests()
  res.status(200).json({ requests })
})

export const getOne = asyncHandler(async (req, res) => {
  const request = await getBloodRequestById(req.params.id)
  res.status(200).json({ request })
})

export const update = asyncHandler(async (req, res) => {
  if (req.body.urgency && !isValidUrgency(req.body.urgency)) {
    return res.status(400).json({ error: 'Invalid urgency level' })
  }
  if (req.body.units !== undefined && !isPositiveInteger(req.body.units)) {
    return res.status(400).json({ error: 'units must be a positive integer' })
  }

  const request = await updateBloodRequest(req.params.id, req.user.id, req.body)
  res.status(200).json({ request })
})

export const transitionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body

  if (!status || !Object.keys(REQUEST_STATE_TRANSITIONS).includes(status)) {
    return res.status(400).json({ error: 'A valid status is required' })
  }

  const request = await transitionBloodRequestStatus(req.params.id, req.user.id, status)
  if (status === 'FULFILLED') {
    await rewardDonorOnFulfilled(request.id)
  }
  res.status(200).json({ request })
})

export const remove = asyncHandler(async (req, res) => {
  const request = await cancelBloodRequest(req.params.id, req.user.id)
  res.status(200).json({ request })
})
