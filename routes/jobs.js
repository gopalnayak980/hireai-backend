const express = require('express')
const router = express.Router()
const Job = require('../models/Job')
const jwt = require('jsonwebtoken')

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'No token!' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token!' })
  }
}

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 })
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ message: 'Job not found!' })
    res.json(job)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Post a job (recruiter only)
router.post('/', auth, async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, postedBy: req.user.id })
    res.status(201).json(job)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
