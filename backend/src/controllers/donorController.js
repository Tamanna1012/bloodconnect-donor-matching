import {
  getMyDonorProfile,
  upsertDonorProfile,
  setDonorAvailability,
  listDonorProfiles,
  getDonorProfileById,
} from '../services/donorService.js'
import {
  isValidBloodGroup,
  isValidLatitude,
  isValidLongitude,
} from '../utils/validators.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const getMine = asyncHandler(async (req, res) => {
  const donorProfile = await getMyDonorProfile(req.user.id)
  res.status(200).json({ donorProfile })
})

export const upsertProfile = asyncHandler(async (req, res) => {
  const { bloodGroup, city, latitude, longitude } = req.body

  if (!bloodGroup || !isValidBloodGroup(bloodGroup)) {
    return res.status(400).json({ error: 'A valid bloodGroup is required' })
  }
  if (!city) {
    return res.status(400).json({ error: 'city is required' })
  }
  if (latitude !== undefined && latitude !== null && !isValidLatitude(latitude)) {
    return res.status(400).json({ error: 'Invalid latitude' })
  }
  if (longitude !== undefined && longitude !== null && !isValidLongitude(longitude)) {
    return res.status(400).json({ error: 'Invalid longitude' })
  }

  const profile = await upsertDonorProfile(req.user.id, { bloodGroup, city, latitude, longitude })
  res.status(200).json({ donorProfile: profile })
})

export const updateAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ error: 'isAvailable must be true or false' })
  }

  const profile = await setDonorAvailability(req.user.id, isAvailable)
  res.status(200).json({ donorProfile: profile })
})

export const list = asyncHandler(async (req, res) => {
  const { bloodGroup, city } = req.query
  const donors = await listDonorProfiles({ bloodGroup, city })
  res.status(200).json({ donors })
})

export const getOne = asyncHandler(async (req, res) => {
  const donor = await getDonorProfileById(req.params.id)
  res.status(200).json({ donor })
})
