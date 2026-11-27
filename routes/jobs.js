const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const Job = require('../models/Job')
const auth = require('../middleware/auth')
const createIpRateLimit = require('../middleware/ipRateLimit')
const { CURRENCY_BY_COUNTRY, formatLegacySalary } = require('../utils/jobSalary')
const { searchAdzuna } = require('../utils/adzunaSearch')

const isString = (value) => typeof value === 'string'
const cleanText = (value, maxLength) => isString(value) && value.trim().length > 0 && value.trim().length <= maxLength
const RESULTS_PER_PAGE = 10
const MAX_SEARCH_PAGE = 100
const LIST_PAGE_SIZE = 50
const MAX_LIST_PAGE = 10000
const SUPPORTED_COUNTRIES = new Set([
  'in', 'gb', 'us', 'at', 'au', 'be', 'br', 'ca', 'ch', 'de',
  'es', 'fr', 'it', 'mx', 'nl', 'nz', 'pl', 'sg', 'za',
])
const searchRateLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 120,
  message: 'Job search limit reached. Please try again later.',
})

const parseListPage = (value) => {
  const text = value === undefined ? '1' : value
  const page = typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_LIST_PAGE ? page : null
}

router.get('/search', searchRateLimit, async (req, res) => {
  const { what, where } = req.query
  const requestedCountry = req.query.country
  const country = requestedCountry === undefined
    ? 'in'
    : typeof requestedCountry === 'string'
      ? requestedCountry.trim().toLowerCase()
      : ''
  const requestedPage = req.query.page
  const pageText = typeof requestedPage === 'string' ? requestedPage.trim() : ''
  const page = requestedPage === undefined ? 1 : (/^\d+$/.test(pageText) ? Number(pageText) : NaN)
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_SEARCH_PAGE) {
    return res.status(400).json({ message: `Page must be an integer between 1 and ${MAX_SEARCH_PAGE}` })
  }
  if (!SUPPORTED_COUNTRIES.has(country)) {
    return res.status(400).json({ message: 'Unsupported country code' })
  }
  if ((what !== undefined && !cleanText(what, 200)) || (where !== undefined && !cleanText(where, 200))) {
    return res.status(400).json({ message: 'Search keywords and location must be 1–200 characters' })
  }

  try {
    const response = await searchAdzuna({
      country,
      page,
      params: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: what || 'developer',
        where: where || (country === 'in' ? 'india' : undefined),
        results_per_page: RESULTS_PER_PAGE,
      },
      timeout: 10000,
    })

    const jobs = response.data.results.map((job) => ({
      id: job.id,
      source: 'adzuna',
      country,
      title: job.title,
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || 'Remote',
      salary: formatLegacySalary(country, job.salary_min, job.salary_max),
      ...(Number.isFinite(job.salary_min) && job.salary_min > 0 ? { salaryMin: job.salary_min } : {}),
      ...(Number.isFinite(job.salary_max) && job.salary_max > 0 ? { salaryMax: job.salary_max } : {}),
      currencyCode: CURRENCY_BY_COUNTRY[country],
      description: job.description,
      url: job.redirect_url,
      created: job.created,
    }))

    const total = Number.isFinite(response.data.count) && response.data.count >= 0
      ? response.data.count
      : jobs.length
    const hasMore = page < MAX_SEARCH_PAGE &&
      jobs.length === RESULTS_PER_PAGE &&
      page * RESULTS_PER_PAGE < total

    return res.json({ jobs, total, page, pageSize: RESULTS_PER_PAGE, hasMore })
  } catch {
    return res.status(502).json({ message: 'Job search is temporarily unavailable' })
  }
})

router.get('/', async (req, res) => {
  const page = parseListPage(req.query.page)
  if (!page) return res.status(400).json({ message: 'Page must be an integer between 1 and 10000' })
  try {
    const [jobs, total] = await Promise.all([
      Job.find().select('-postedBy').sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * LIST_PAGE_SIZE).limit(LIST_PAGE_SIZE).maxTimeMS(5000),
      Job.countDocuments().maxTimeMS(5000),
    ])
    res.set({
      'X-Total-Count': String(total),
      'X-Has-More': String(page * LIST_PAGE_SIZE < total),
      'X-Page': String(page),
    })
    return res.json(jobs.map((job) => ({ ...job.toJSON(), source: 'recruiter' })))
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Job not found!' })
  }
  try {
    const job = await Job.findById(req.params.id).select('-postedBy')
    if (!job) return res.status(404).json({ message: 'Job not found!' })
    return res.json({ ...job.toJSON(), source: 'recruiter' })
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
    return res.status(201).json({ ...job.toJSON(), source: 'recruiter' })
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
