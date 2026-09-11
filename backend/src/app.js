import express from 'express'
import cors from 'cors'
import prisma from './utils/prisma.js'
import authRoutes from './routes/authRoutes.js'
import bloodRequestRoutes from './routes/bloodRequestRoutes.js'
import donorRoutes from './routes/donorRoutes.js'
import matchRoutes from './routes/matchRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

const app = express()

app.use(cors())
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

export default app
