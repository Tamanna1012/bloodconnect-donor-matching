import { PrismaClient } from '@prisma/client'

// A single shared PrismaClient instance for the whole app.
// Creating a new PrismaClient per request would open too many DB connections.
const prisma = new PrismaClient()

export default prisma
