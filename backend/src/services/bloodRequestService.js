import prisma from '../utils/prisma.js'
import { assertFound, assertOwnership } from '../utils/httpErrors.js'

export async function createBloodRequest(requesterId, data) {
  return prisma.bloodRequest.create({
    data: {
      requesterId,
      bloodGroup: data.bloodGroup,
      units: data.units,
      city: data.city,
      urgency: data.urgency,
      description: data.description,
      requiredBy: data.requiredBy ? new Date(data.requiredBy) : null,
      latitude: data.latitude,
      longitude: data.longitude,
    },
  })
}

export async function listBloodRequests() {
  return prisma.bloodRequest.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getBloodRequestById(id) {
  const request = await prisma.bloodRequest.findUnique({ where: { id } })
  assertFound(request, 'Blood request')
  return request
}

export async function updateBloodRequest(id, requestingUserId, updates) {
  const request = await getBloodRequestById(id)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')

  return prisma.bloodRequest.update({
    where: { id },
    data: updates,
  })
}

// "Delete" cancels rather than hard-deletes — see README for why
// (DonorMatch has ON DELETE RESTRICT against BloodRequest).
export async function cancelBloodRequest(id, requestingUserId) {
  const request = await getBloodRequestById(id)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')

  return prisma.bloodRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
}
