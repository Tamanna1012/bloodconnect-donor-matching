import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankDonorsForRequest,
  isEligibleDonor,
  scoreDonor,
  validateRequestForMatching,
} from '../services/bloodMatchingEngine.js'

function makeRequest(overrides = {}) {
  return {
    bloodGroup: 'O_POS',
    city: 'Chennai',
    latitude: null,
    longitude: null,
    urgency: 'NORMAL',
    status: 'OPEN',
    requesterId: 'recipient-1',
    ...overrides,
  }
}

function makeDonor(overrides = {}) {
  return {
    id: 'donor-1',
    userId: 'donor-user-1',
    bloodGroup: 'O_NEG',
    city: 'Chennai',
    latitude: null,
    longitude: null,
    isAvailable: true,
    requestsReceived: 0,
    requestsAccepted: 0,
    donationsCompleted: 0,
    ...overrides,
  }
}

test('a compatible, available donor is accepted (included) in the ranked list', () => {
  const request = makeRequest({ bloodGroup: 'A_POS' })
  const donor = makeDonor({ bloodGroup: 'O_NEG', isAvailable: true })

  const ranked = rankDonorsForRequest(request, [donor])
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].donorProfile.id, donor.id)
})

test('an incompatible donor is rejected (excluded), regardless of score', () => {
  const request = makeRequest({ bloodGroup: 'A_POS' })
  // B is not compatible with A per the ABO rule.
  const donor = makeDonor({ bloodGroup: 'B_POS', isAvailable: true })

  const ranked = rankDonorsForRequest(request, [donor])
  assert.equal(ranked.length, 0)
})

test('an unavailable donor is rejected even if blood-group compatible', () => {
  const request = makeRequest({ bloodGroup: 'A_POS' })
  const donor = makeDonor({ bloodGroup: 'O_NEG', isAvailable: false })

  const ranked = rankDonorsForRequest(request, [donor])
  assert.equal(ranked.length, 0)
})

test('a nearer donor is ranked higher than a farther donor', () => {
  const request = makeRequest({ bloodGroup: 'O_POS', city: 'Chennai' })
  const nearDonor = makeDonor({ id: 'near', bloodGroup: 'O_NEG', city: 'Chennai' })
  const farDonor = makeDonor({ id: 'far', bloodGroup: 'O_NEG', city: 'Mumbai' })

  const ranked = rankDonorsForRequest(request, [farDonor, nearDonor])

  assert.equal(ranked[0].donorProfile.id, 'near')
  assert.equal(ranked[1].donorProfile.id, 'far')
  assert.ok(ranked[0].totalScore > ranked[1].totalScore)
})

test('an EMERGENCY request scores higher than the same donor under a NORMAL request', () => {
  const donor = makeDonor({ bloodGroup: 'O_NEG' })

  const normalScore = scoreDonor(makeRequest({ urgency: 'NORMAL' }), donor)
  const emergencyScore = scoreDonor(makeRequest({ urgency: 'EMERGENCY' }), donor)

  assert.ok(emergencyScore.totalScore > normalScore.totalScore)
  assert.equal(emergencyScore.urgencyScore, 30)
  assert.equal(normalScore.urgencyScore, 0)
})

test('a more reliable donor is ranked higher than a less reliable donor, all else equal', () => {
  const request = makeRequest({ bloodGroup: 'O_POS', city: 'Chennai' })
  const reliableDonor = makeDonor({
    id: 'reliable',
    bloodGroup: 'O_NEG',
    city: 'Chennai',
    requestsReceived: 10,
    requestsAccepted: 10,
    donationsCompleted: 5,
  })
  const unreliableDonor = makeDonor({
    id: 'unreliable',
    bloodGroup: 'O_NEG',
    city: 'Chennai',
    requestsReceived: 10,
    requestsAccepted: 1,
    donationsCompleted: 0,
  })

  const ranked = rankDonorsForRequest(request, [unreliableDonor, reliableDonor])

  assert.equal(ranked[0].donorProfile.id, 'reliable')
  assert.equal(ranked[1].donorProfile.id, 'unreliable')
})

test('isEligibleDonor is the single source of truth for the hard filters', () => {
  const request = makeRequest({ bloodGroup: 'A_POS' })
  assert.equal(isEligibleDonor(request, makeDonor({ bloodGroup: 'O_NEG', isAvailable: true })), true)
  assert.equal(isEligibleDonor(request, makeDonor({ bloodGroup: 'B_POS', isAvailable: true })), false)
  assert.equal(isEligibleDonor(request, makeDonor({ bloodGroup: 'O_NEG', isAvailable: false })), false)
})

test('a user cannot be matched to their own request (self-match hard filter)', () => {
  const request = makeRequest({ bloodGroup: 'O_POS', requesterId: 'same-person' })
  const ownDonorProfile = makeDonor({ bloodGroup: 'O_NEG', userId: 'same-person' })

  assert.equal(isEligibleDonor(request, ownDonorProfile), false)

  const ranked = rankDonorsForRequest(request, [ownDonorProfile])
  assert.equal(ranked.length, 0)
})

test('validateRequestForMatching rejects requests that are already FULFILLED or CANCELLED', () => {
  assert.throws(
    () => validateRequestForMatching(makeRequest({ status: 'FULFILLED' })),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )
  assert.throws(
    () => validateRequestForMatching(makeRequest({ status: 'CANCELLED' })),
    (err) => {
      assert.equal(err.statusCode, 400)
      return true
    },
  )
})

test('validateRequestForMatching accepts OPEN and MATCHING requests', () => {
  assert.doesNotThrow(() => validateRequestForMatching(makeRequest({ status: 'OPEN' })))
  assert.doesNotThrow(() => validateRequestForMatching(makeRequest({ status: 'MATCHING' })))
})
