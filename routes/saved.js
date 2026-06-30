const express = require('express')
const router = express.Router()
const SavedJob = require('../models/SavedJob')
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

// Save a job
router.post('/', auth, async (req, res) => {
  try {
    const { jobId, title, company, location, salary, url } = req.body

    // Check already saved
    const existing = await SavedJob.findOne({ user: req.user.id, jobId })
    if (existing) return res.status(400).json({ message: 'Job already saved!' })

    const saved = await SavedJob.create({
      user: req.user.id, jobId, title, company, location, salary, url
    })
    res.status(201).json(saved)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all saved jobs
router.get('/', auth, async (req, res) => {
  try {
    const jobs = await SavedJob.find({ user: req.user.id }).sort({ createdAt: -1 })
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Remove saved job
router.delete('/:jobId', auth, async (req, res) => {
  try {
    await SavedJob.findOneAndDelete({ user: req.user.id, jobId: req.params.jobId })
    res.json({ message: 'Job removed!' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router