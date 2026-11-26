const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()

const localOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

const getConfiguredOrigins = () => [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    let parsed
    try {
      parsed = new URL(value)
    } catch {
      throw new Error('FRONTEND_URL and FRONTEND_URLS must contain valid origins')
    }
    if (parsed.origin !== value.replace(/\/$/, '') || parsed.username || parsed.password) {
      throw new Error('FRONTEND_URL and FRONTEND_URLS must contain origins without paths or credentials')
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Production frontend origins must use HTTPS')
    }
    return parsed.origin
  })

const configureTrustProxy = () => {
  const configuredHops = process.env.TRUST_PROXY
  const defaultHops = process.env.NODE_ENV === 'production' ? 1 : 0
  const hops = configuredHops === undefined || configuredHops === '' ? defaultHops : Number(configuredHops)
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error('TRUST_PROXY must be an integer from 0 to 5')
  }
  app.set('trust proxy', hops)
}

configureTrustProxy()
const configuredOrigins = getConfiguredOrigins()
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('Configure FRONTEND_URL or FRONTEND_URLS before starting in production')
}
const allowedOrigins = new Set([
  ...(process.env.NODE_ENV === 'production' ? [] : localOrigins),
  ...configuredOrigins,
])

app.use(cors({
  origin(origin, callback) {
    // Requests without Origin are non-browser clients and receive no CORS headers.
    if (!origin) return callback(null, false)
    if (allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin not allowed by CORS'))
  },
  credentials: true,
  exposedHeaders: ['X-Total-Count', 'X-Has-More', 'X-Page'],
}))
app.use(express.json({ limit: '1mb' }))

app.get('/health/live', (req, res) => res.json({ status: 'ok' }))
app.get('/health/ready', (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ status: 'unavailable' })
  return res.json({ status: 'ok' })
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/jobs', require('./routes/jobs'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/saved', require('./routes/saved'))
app.use('/api/applications', require('./routes/applications'))
app.use('/api/interview-sessions', require('./routes/interviewSessions'))

app.get('/', (req, res) => {
  res.json({ message: 'HireAI Backend Running' })
})

app.use((req, res) => res.status(404).json({ message: 'Resource not found' }))

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large' })
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON request body' })
  }
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ message: 'Origin not allowed' })
  return res.status(500).json({ message: 'Server error' })
})

const startServer = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured before starting')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  if (process.env.NODE_ENV === 'production' &&
      (!process.env.GEMINI_API_KEY || !process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY)) {
    throw new Error('Configure Gemini and Adzuna credentials before starting in production')
  }
  const port = Number(process.env.PORT || 5000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port')

  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: process.env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 10000,
    family: 4,
  })
  let server
  try {
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, '0.0.0.0')
      listener.once('listening', () => resolve(listener))
      listener.once('error', reject)
    })
  } catch (error) {
    await mongoose.disconnect()
    throw error
  }
  console.info('HireAI API listening')

  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`Received ${signal}; shutting down`)
    const forceExit = setTimeout(() => process.exit(1), 10000)
    forceExit.unref()
    server.close(async () => {
      clearTimeout(forceExit)
      try {
        await mongoose.disconnect()
        process.exitCode = 0
      } catch {
        process.exitCode = 1
      }
    })
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
  return server
}

if (require.main === module) {
  startServer().catch(() => {
    console.error('HireAI API startup failed; check required environment configuration and database availability')
    process.exitCode = 1
  })
}

module.exports = app
module.exports.startServer = startServer
