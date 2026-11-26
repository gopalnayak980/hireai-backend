const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const createIpRateLimit = require('../middleware/ipRateLimit')

const registrationRateLimit = createIpRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many registration attempts. Please try again later.',
})
const loginRateLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many login attempts. Please try again later.',
})

const isString = (value) => typeof value === 'string'
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const invalidCredentials = { message: 'Invalid email or password' }

router.post('/register', registrationRateLimit, async (req, res) => {
  const { name, email, password } = req.body || {}
  if (!isString(name) || !name.trim() || name.trim().length > 100 ||
      !isString(email) || email.trim().length > 254 || !validEmail(email.trim()) ||
      !isString(password) || password.length < 6 || password.length > 128) {
    return res.status(400).json({ message: 'Name, valid email, and password (6–128 characters) are required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  try {
    const existing = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') })
    if (existing) return res.status(400).json({ message: 'Email already registered!' })

    const hashed = await bcrypt.hash(password, 10)
    // Public registration always creates a jobseeker; privileged roles require a trusted process.
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashed, role: 'jobseeker' })
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Email already registered!' })
    return res.status(500).json({ message: 'Server error' })
  }
})

router.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body || {}
  if (!isString(email) || email.trim().length > 254 || !validEmail(email.trim()) ||
      !isString(password) || !password.length || password.length > 128) {
    return res.status(400).json({ message: 'Valid email and password are required' })
  }

  try {
    // Case-insensitive lookup keeps accounts created before email normalization usable.
    const normalizedEmail = email.trim().toLowerCase()
    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json(invalidCredentials)
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
