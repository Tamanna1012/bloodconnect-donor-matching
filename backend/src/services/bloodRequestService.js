import prisma from '../utils/prisma.js'
import { assertFound, assertOwnership, httpError } from '../utils/httpErrors.js'
import { assertValidTransition } from './requestStateMachine.js'

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

// status is deliberately NOT accepted here -- it must go through
// transitionBloodRequestStatus(), which enforces the state machine.
// Without this guard, {"status": "FULFILLED"} in a plain PUT body would
// silently skip every transition rule below.
export async function updateBloodRequest(id, requestingUserId, updates) {
  if (updates.status !== undefined) {
    throw httpError(400, 'Use the status-transition endpoint (PUT /:id/status) to change status')
  }

  const request = await getBloodRequestById(id)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')

  return prisma.bloodRequest.update({
    where: { id },
    data: updates,
  })
}

export async function transitionBloodRequestStatus(id, requestingUserId, nextStatus) {
  const request = await getBloodRequestById(id)
  assertOwnership(request.requesterId, requestingUserId, 'blood request')
  assertValidTransition(request.status, nextStatus)

  return prisma.bloodRequest.update({
    where: { id },
    data: { status: nextStatus },
  })
}

// "Delete" cancels rather than hard-deletes — see README for why
// (DonorMatch has ON DELETE RESTRICT against BloodRequest). Now routed
// through the state machine, so cancelling a FULFILLED request is
// correctly rejected instead of silently succeeding.
export async function cancelBloodRequest(id, requestingUserId) {
  return transitionBloodRequestStatus(id, requestingUserId, 'CANCELLED')
}
