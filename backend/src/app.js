import express from 'express'
import cors from 'cors'
import prisma from './utils/prisma.js'
import authRoutes from './routes/authRoutes.js'
import bloodRequestRoutes from './routes/bloodRequestRoutes.js'
import donorRoutes from './routes/donorRoutes.js'
import matchRoutes from './routes/matchRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

// In development, allow the Vite dev server's default origin as a
// fallback so the project works out of the box before FRONTEND_URL is
// set. In production, FRONTEND_URL must be set -- without it, no browser
// origin is allowed to call this API at all, which is the safe default
// (fail closed, not open).
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ message: 'BloodConnect backend is running', database: 'connected' })
  } catch (err) {
    res.status(500).json({ message: 'BloodConnect backend is running', database: 'unreachable' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/requests', bloodRequestRoutes)
app.use('/api/donors', donorRoutes)
app.use('/api/matches', matchRoutes)
app.use('/api/notifications', notificationRoutes)

// Order matters below: an unmatched route falls through to
// notFoundHandler, and any error thrown/forwarded by a route (via
// asyncHandler) falls through to errorHandler. Both must be registered
// after every real route, and errorHandler must be last of all --
// Express identifies it as error-handling middleware by its 4 arguments.
app.use(notFoundHandler)
app.use(errorHandler)

export default app
