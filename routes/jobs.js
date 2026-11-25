const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const Job = require('../models/Job')
const auth = require('../middleware/auth')
const axios = require('axios')

const isString = (value) => typeof value === 'string'
const cleanText = (value, maxLength) => isString(value) && value.trim().length > 0 && value.trim().length <= maxLength

router.get('/search', async (req, res) => {
  const { what, where } = req.query
  if ((what !== undefined && !cleanText(what, 200)) || (where !== undefined && !cleanText(where, 200))) {
    return res.status(400).json({ message: 'Search keywords and location must be 1–200 characters' })
  }

  try {
    const response = await axios.get('https://api.adzuna.com/v1/api/jobs/in/search/1', {
      params: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: what || 'developer',
        where: where || 'india',
        results_per_page: 10,
      },
      timeout: 10000,
    })

    const jobs = response.data.results.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || 'Remote',
      salary: job.salary_min
        ? `₹${Math.round(job.salary_min / 1000)}K - ₹${Math.round(job.salary_max / 1000)}K`
        : 'Not disclosed',
      description: job.description,
      url: job.redirect_url,
      created: job.created,
    }))

    return res.json({ jobs, total: response.data.count })
  } catch {
    return res.status(502).json({ message: 'Job search is temporarily unavailable' })
  }
})

router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 })
    return res.json(jobs)
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Job not found!' })
  }
  try {
    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ message: 'Job not found!' })
    return res.json(job)
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

router.post('/', auth, auth.requireRole('recruiter'), async (req, res) => {
  const body = req.body || {}
  const { title, company, location, salary, type, skills, description, experience, openings } = body
  const validType = type === undefined || ['Full Time', 'Remote', 'Part Time'].includes(type)
  const validSkills = skills === undefined || (
    Array.isArray(skills) && skills.length <= 50 && skills.every((skill) => cleanText(skill, 100))
  )
  const validOpenings = openings === undefined || (Number.isInteger(openings) && openings > 0 && openings <= 10000)

  if (!cleanText(title, 200) || !cleanText(company, 200) || !cleanText(location, 200) ||
      !validType || !validSkills || !validOpenings ||
      (salary !== undefined && (!isString(salary) || salary.length > 100)) ||
      (description !== undefined && (!isString(description) || description.length > 20000)) ||
      (experience !== undefined && (!isString(experience) || experience.length > 100))) {
    return res.status(400).json({ message: 'Invalid job details' })
  }

  try {
    const job = await Job.create({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      salary,
      type,
      skills,
      description,
      experience,
      openings,
      postedBy: req.user.id,
    })
    return res.status(201).json(job)
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
