import 'dotenv/config'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../utils/prisma.js'
import { registerUser, loginUser } from '../services/authService.js'

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

test('registerUser creates a new user and returns a token', async () => {
  const email = uniqueEmail()
  const { user, token } = await registerUser({
    name: 'Alice',
    email,
    password: 'secret123',
  })

  assert.equal(user.email, email)
  assert.equal(user.password, undefined) // password hash must never be returned
  assert.ok(token)

  await prisma.user.delete({ where: { id: user.id } })
})

test('registerUser rejects a duplicate email', async () => {
  const email = uniqueEmail()
  const { user } = await registerUser({ name: 'Bob', email, password: 'secret123' })

  await assert.rejects(
    () => registerUser({ name: 'Bob 2', email, password: 'anotherpass' }),
    /already registered/,
  )

  await prisma.user.delete({ where: { id: user.id } })
})

test('loginUser succeeds with the correct password', async () => {
  const email = uniqueEmail()
  const { user } = await registerUser({ name: 'Carol', email, password: 'secret123' })

  const result = await loginUser({ email, password: 'secret123' })
  assert.equal(result.user.email, email)
  assert.ok(result.token)

  await prisma.user.delete({ where: { id: user.id } })
})

test('loginUser rejects the wrong password', async () => {
  const email = uniqueEmail()
  const { user } = await registerUser({ name: 'Dave', email, password: 'secret123' })

  await assert.rejects(
    () => loginUser({ email, password: 'wrong-password' }),
    /Invalid email or password/,
  )

  await prisma.user.delete({ where: { id: user.id } })
})

after(async () => {
  await prisma.$disconnect()
})
