import { isCompatible } from './bloodCompatibility.js'
import { calculateProximityScore } from './proximity.js'
import { calculateReliabilityScore } from './donorReliability.js'
import { httpError } from '../utils/httpErrors.js'

// Matching a request against donors only makes sense while it's still
// actively looking for donors. A FULFILLED or CANCELLED request has
// nothing left to match.
const MATCHABLE_STATUSES = ['OPEN', 'MATCHING']

// Urgency contributes fixed points, equal for every donor candidate of a
// given request -- so it never reorders donors WITHIN one request's
// ranking. Its purpose is giving the score meaning ACROSS requests (an
// emergency request's matches all carry a visibly higher score).
const URGENCY_SCORE = {
  NORMAL: 0,
  URGENT: 15,
  EMERGENCY: 30,
}

// STEP 1: validate the request is in a matchable state.
export function validateRequestForMatching(request) {
  if (!MATCHABLE_STATUSES.includes(request.status)) {
    throw httpError(
      400,
      `Cannot find donors for a request with status "${request.status}"`,
    )
  }
}

// STEPS 2 & 3 (+ a third hard filter): all must pass, or the donor is
// excluded entirely -- never just given a low score. A requester cannot
// be matched to their own request even if they also have a compatible,
// available donor profile -- found via an end-to-end browser test where
// a single user acted as both recipient and donor.
export function isEligibleDonor(request, donorProfile) {
  if (!donorProfile.isAvailable) return false
  if (donorProfile.userId === request.requesterId) return false
  if (!isCompatible(donorProfile.bloodGroup, request.bloodGroup)) return false
  return true
}

// STEPS 4-6: score one donor already known to be eligible.
export function scoreDonor(request, donorProfile) {
  const proximityScore = calculateProximityScore(request, donorProfile)
  const urgencyScore = URGENCY_SCORE[request.urgency] ?? 0
  const reliabilityScore = calculateReliabilityScore(donorProfile)

  return {
    proximityScore,
    urgencyScore,
    reliabilityScore,
    totalScore: proximityScore + urgencyScore + reliabilityScore,
  }
}

/**
 * Core matching algorithm. Pure function: takes a BloodRequest and a list
 * of candidate DonorProfiles already loaded from the database, and
 * returns only the eligible ones, ranked highest score first.
 *
 * Deliberately does NOT touch Prisma, create DonorMatch rows, or send
 * notifications -- that orchestration (fetching candidates, persisting
 * results, notifying donors) belongs to the API/service layer that calls
 * this, so the algorithm itself stays easy to unit test with plain
 * objects.
 */
export function rankDonorsForRequest(request, donorProfiles) {
  validateRequestForMatching(request)

  return donorProfiles
    .filter((donorProfile) => isEligibleDonor(request, donorProfile))
    .map((donorProfile) => ({
      donorProfile,
      ...scoreDonor(request, donorProfile),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
}
