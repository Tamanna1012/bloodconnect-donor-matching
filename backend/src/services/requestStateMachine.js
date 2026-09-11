import { httpError } from '../utils/httpErrors.js'

// The full transition table for BloodRequest.status. Each entry lists the
// states a request CAN move to from that state; an empty array means the
// state is terminal (no transitions out at all).
export const REQUEST_STATE_TRANSITIONS = {
  OPEN: ['MATCHING', 'CANCELLED'],
  MATCHING: ['DONOR_CONTACTED', 'CANCELLED'],
  DONOR_CONTACTED: ['ACCEPTED', 'MATCHING', 'CANCELLED'], // donor declines -> back to MATCHING
  ACCEPTED: ['FULFILLED', 'MATCHING', 'CANCELLED'], // accepted donor backs out -> back to MATCHING
  FULFILLED: [], // terminal: a completed donation is final
  CANCELLED: [], // terminal: a cancelled request is final
}

export function isValidTransition(fromStatus, toStatus) {
  return REQUEST_STATE_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false
}

export function assertValidTransition(fromStatus, toStatus) {
  if (!isValidTransition(fromStatus, toStatus)) {
    throw httpError(400, `Cannot move a request from "${fromStatus}" to "${toStatus}"`)
  }
}
