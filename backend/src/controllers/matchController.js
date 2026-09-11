import {
  findMatchesForRequest,
  acceptMatch,
  declineMatch,
} from '../services/matchService.js'

export async function findMatches(req, res) {
  try {
    const matches = await findMatchesForRequest(req.params.id, req.user.id)
    res.status(200).json({ matches })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function accept(req, res) {
  try {
    const match = await acceptMatch(req.params.id, req.user.id)
    res.status(200).json({ match })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

export async function decline(req, res) {
  try {
    const match = await declineMatch(req.params.id, req.user.id)
    res.status(200).json({ match })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
