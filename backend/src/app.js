import express from 'express'
import cors from 'cors'
import prisma from './utils/prisma.js'

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

export default app
