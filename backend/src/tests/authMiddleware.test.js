import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireAuth } from '../middleware/authMiddleware.js'

function mockRes() {
  const res = {}
  res.statusCode = null
  res.body = null
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    res.body = body
    return res
  }
  return res
}

test('requireAuth rejects a request with no Authorization header', async () => {
  const req = { headers: {} }
  const res = mockRes()
  let nextCalled = false

  await requireAuth(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
})

test('requireAuth rejects an invalid/forged token', async () => {
  const req = { headers: { authorization: 'Bearer not-a-real-token' } }
  const res = mockRes()
  let nextCalled = false

  await requireAuth(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
})
