import {
  createBloodRequest,
  listBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest,
} from '../services/bloodRequestService.js'
import {
  isValidBloodGroup,
  isValidUrgency,
  isPositiveInteger,
} from '../utils/validators.js'

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

export async function create(req, res) {
  const validationError = validateCreatePayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  try {
    const request = await createBloodRequest(req.user.id, req.body)
    res.status(201).json({ request })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function list(req, res) {
  const requests = await listBloodRequests()
  res.status(200).json({ requests })
}

export async function getOne(req, res) {
  try {
    const request = await getBloodRequestById(req.params.id)
    res.status(200).json({ request })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function update(req, res) {
  if (req.body.urgency && !isValidUrgency(req.body.urgency)) {
    return res.status(400).json({ error: 'Invalid urgency level' })
  }
  if (req.body.units !== undefined && !isPositiveInteger(req.body.units)) {
    return res.status(400).json({ error: 'units must be a positive integer' })
  }

  try {
    const request = await updateBloodRequest(req.params.id, req.user.id, req.body)
    res.status(200).json({ request })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function remove(req, res) {
  try {
    const request = await cancelBloodRequest(req.params.id, req.user.id)
    res.status(200).json({ request })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
