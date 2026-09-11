import {
  findMatchesForRequest,
  listMyMatches,
  acceptMatch,
  declineMatch,
} from '../services/matchService.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const listMine = asyncHandler(async (req, res) => {
  const matches = await listMyMatches(req.user.id, req.query.status)
  res.status(200).json({ matches })
})

export const findMatches = asyncHandler(async (req, res) => {
  const matches = await findMatchesForRequest(req.params.id, req.user.id)
  res.status(200).json({ matches })
})

export const accept = asyncHandler(async (req, res) => {
  const match = await acceptMatch(req.params.id, req.user.id)
  res.status(200).json({ match })
})

export const decline = asyncHandler(async (req, res) => {
  const match = await declineMatch(req.params.id, req.user.id)
  res.status(200).json({ match })
})
