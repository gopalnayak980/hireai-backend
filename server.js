const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()
// Configure this hop count to match the trusted ingress proxy topology so req.ip
// identifies the original client for IP-based request limits.
app.set('trust proxy', 1)

const localOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]
const configuredOrigins = [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
const allowedOrigins = new Set([...localOrigins, ...configuredOrigins])

app.use(cors({
  origin(origin, callback) {
    // Non-browser clients do not send Origin and do not receive CORS headers.
    if (!origin) return callback(null, false)
    if (allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/jobs', require('./routes/jobs'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/saved', require('./routes/saved'))

app.get('/', (req, res) => {
  res.json({ message: 'HireAI Backend Running! 🚀' })
})

app.use((req, res) => res.status(404).json({ message: 'Resource not found' }))

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' })
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON request body' })
  }
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' })
  }
  return res.status(500).json({ message: 'Server error' })
})

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4,
})
  .then(() => {
    console.log('MongoDB connected')
    const port = process.env.PORT || 5000
    app.listen(port, () => console.log(`Server running on port ${port}`))
  })
  .catch(() => {
    console.error('MongoDB connection failed')
    process.exitCode = 1
  })

module.exports = app
