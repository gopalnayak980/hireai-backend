const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()

// Middleware PEHLE
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// Routes BAAD MEIN
app.use('/api/auth', require('./routes/auth'))
app.use('/api/jobs', require('./routes/jobs'))
app.use('/api/ai', require('./routes/ai'))

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'HireAI Backend Running! 🚀' })
})

// Connect MongoDB
mongoose.connect('mongodb://localhost:27017/hireai', {
  serverSelectionTimeoutMS: 10000,
  family: 4
})
  .then(() => {
    console.log('✅ MongoDB Connected!')
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    })
  })
  .catch(err => console.log('❌ MongoDB Error:', err))