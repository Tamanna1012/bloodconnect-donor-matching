import prisma from '../utils/prisma.js'
import { assertFound } from '../utils/httpErrors.js'

// Public view of a donor: no exact coordinates, no linked user contact
// info (email/phone) -- only what's needed to browse/display a donor.
// A donor's own view of their own profile (e.g. after PUT) skips this
// and sees the full record, since there's no privacy concern with a user
// seeing their own data.
export function sanitizeDonorProfile(donorProfile) {
  const { latitude, longitude, user, ...rest } = donorProfile
  return {
    ...rest,
    donorName: user?.name,
    city: donorProfile.city,
  }
}

export async function upsertDonorProfile(userId, data) {
  return prisma.donorProfile.upsert({
    where: { userId },
    create: {
      userId,
      bloodGroup: data.bloodGroup,
      city: data.city,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    },
    update: {
      bloodGroup: data.bloodGroup,
      city: data.city,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    },
  })
}

// Self-scoped by design: there is no donorProfileId in this operation's
// input, only the logged-in user's own id, so there is no URL parameter
// an attacker could tamper with to target someone else's profile.
export async function setDonorAvailability(userId, isAvailable) {
  const profile = await prisma.donorProfile.findUnique({ where: { userId } })
  assertFound(profile, 'Donor profile')

  return prisma.donorProfile.update({
    where: { userId },
    data: { isAvailable },
  })
}

export async function listDonorProfiles(filters = {}) {
  const where = {}
  if (filters.bloodGroup) where.bloodGroup = filters.bloodGroup
  if (filters.city) where.city = { equals: filters.city, mode: 'insensitive' }

  const profiles = await prisma.donorProfile.findMany({
    where,
    include: { user: { select: { name: true } } },
  })
  return profiles.map(sanitizeDonorProfile)
}

export async function getDonorProfileById(id) {
  const profile = await prisma.donorProfile.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  })
  assertFound(profile, 'Donor profile')
  return sanitizeDonorProfile(profile)
}
