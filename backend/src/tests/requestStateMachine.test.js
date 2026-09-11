import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidTransition,
  assertValidTransition,
  REQUEST_STATE_TRANSITIONS,
} from '../services/requestStateMachine.js'

test('valid transitions from the spec are accepted', () => {
  assert.equal(isValidTransition('OPEN', 'MATCHING'), true)
  assert.equal(isValidTransition('MATCHING', 'DONOR_CONTACTED'), true)
  assert.equal(isValidTransition('DONOR_CONTACTED', 'ACCEPTED'), true)
  assert.equal(isValidTransition('ACCEPTED', 'FULFILLED'), true)
  assert.equal(isValidTransition('OPEN', 'CANCELLED'), true)
})

test('FULFILLED -> OPEN is rejected (the spec\'s explicit invalid example)', () => {
  assert.equal(isValidTransition('FULFILLED', 'OPEN'), false)
})

test('FULFILLED and CANCELLED are terminal states with no valid transitions out', () => {
  assert.deepEqual(REQUEST_STATE_TRANSITIONS.FULFILLED, [])
  assert.deepEqual(REQUEST_STATE_TRANSITIONS.CANCELLED, [])
})

test('skipping a step (OPEN -> ACCEPTED directly) is rejected', () => {
  assert.equal(isValidTransition('OPEN', 'ACCEPTED'), false)
})

test('a donor declining sends the request back to MATCHING, which is valid', () => {
  assert.equal(isValidTransition('DONOR_CONTACTED', 'MATCHING'), true)
})

test('assertValidTransition throws a 400 error for an invalid transition', () => {
  assert.throws(
    () => assertValidTransition('FULFILLED', 'OPEN'),
    (err) => {
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /Cannot move a request from "FULFILLED" to "OPEN"/)
      return true
    },
  )
})

test('assertValidTransition does not throw for a valid transition', () => {
  assert.doesNotThrow(() => assertValidTransition('OPEN', 'MATCHING'))
})
