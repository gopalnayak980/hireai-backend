const express = require('express')
const router = express.Router()
const Job = require('../models/Job')
const jwt = require('jsonwebtoken')
const axios = require('axios')

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

// Search REAL jobs from Adzuna
router.get('/search', async (req, res) => {
  try {
    const { what, where } = req.query

    const response = await axios.get(
      `https://api.adzuna.com/v1/api/jobs/in/search/1`, {
        params: {
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          what: what || 'developer',
          where: where || 'india',
          results_per_page: 10
        }
      }
    )

    const jobs = response.data.results.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || 'Remote',
      salary: job.salary_min
        ? `₹${Math.round(job.salary_min/1000)}K - ₹${Math.round(job.salary_max/1000)}K`
        : 'Not disclosed',
      description: job.description,
      url: job.redirect_url,
      created: job.created
    }))

    res.json({ jobs, total: response.data.count })
  } catch (err) {
    console.error('Adzuna Error:', err.message)
    console.error('Adzuna Details:', err.response?.data)
    res.status(500).json({ message: 'Job search failed', error: err.message })
  }
})

// Get all jobs (local)
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

// Post a job
router.post('/', auth, async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, postedBy: req.user.id })
    res.status(201).json(job)
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router