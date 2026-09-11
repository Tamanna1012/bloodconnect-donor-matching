import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateReliabilityScore } from '../services/donorReliability.js'

test('a brand-new donor with no history gets a neutral score, not zero', () => {
  const score = calculateReliabilityScore({
    requestsReceived: 0,
    requestsAccepted: 0,
    donationsCompleted: 0,
  })
  // 0.5 (neutral) acceptance rate * 20 = 10, no completion bonus
  assert.equal(score, 10)
})

test('a donor with a high acceptance rate scores higher than one with a low rate', () => {
  const reliable = calculateReliabilityScore({
    requestsReceived: 10,
    requestsAccepted: 9,
    donationsCompleted: 0,
  })
  const unreliable = calculateReliabilityScore({
    requestsReceived: 10,
    requestsAccepted: 2,
    donationsCompleted: 0,
  })
  assert.ok(reliable > unreliable)
})

test('completed donations add a bonus, capped at 5 donations', () => {
  const withFewDonations = calculateReliabilityScore({
    requestsReceived: 10,
    requestsAccepted: 10,
    donationsCompleted: 5,
  })
  const withManyDonations = calculateReliabilityScore({
    requestsReceived: 10,
    requestsAccepted: 10,
    donationsCompleted: 50,
  })
  // Bonus caps at min(donationsCompleted, 5) * 2 = 10, so 5 and 50
  // completed donations should score identically.
  assert.equal(withFewDonations, withManyDonations)
})

test('a perfect-acceptance, well-donated donor scores near the maximum (30)', () => {
  const score = calculateReliabilityScore({
    requestsReceived: 20,
    requestsAccepted: 20,
    donationsCompleted: 10,
  })
  assert.equal(score, 30)
})
