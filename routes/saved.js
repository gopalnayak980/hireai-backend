const express = require('express')
const router = express.Router()
const SavedJob = require('../models/SavedJob')
const auth = require('../middleware/auth')
const LIST_PAGE_SIZE = 50
const MAX_LIST_PAGE = 10000

const parsePage = (value) => {
  const text = value === undefined ? '1' : value
  const page = typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_LIST_PAGE ? page : null
}

const isText = (value, maxLength) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
const optionalText = (value, maxLength) => value === undefined || value === '' || (typeof value === 'string' && value.length <= maxLength)

router.post('/', auth, async (req, res) => {
  const { jobId, title, company, location, salary, url, source } = req.body || {}
  const normalizedJobId = (typeof jobId === 'string' || (typeof jobId === 'number' && Number.isFinite(jobId)))
    ? String(jobId).trim()
    : ''
  const validSource = source === undefined || ['adzuna', 'recruiter', 'sample'].includes(source)
  if (!validSource || !isText(normalizedJobId, 200) || !isText(title, 200) || !isText(company, 200) ||
      !optionalText(location, 200) || !optionalText(salary, 100) || !optionalText(url, 2048)) {
    return res.status(400).json({ message: 'Invalid saved job details' })
  }

  try {
    const saved = await SavedJob.create({
      user: req.user.id,
      jobId: normalizedJobId,
      ...(source !== undefined ? { source } : {}),
      title: title.trim(),
      company: company.trim(),
      location,
      salary,
      url,
    })
    return res.status(201).json(saved)
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Job already saved!' })
    return res.status(500).json({ message: 'Server error' })
  }
})

router.get('/', auth, async (req, res) => {
  const page = parsePage(req.query.page)
  if (!page) return res.status(400).json({ message: 'Page must be an integer between 1 and 10000' })
  try {
    const filter = { user: req.user.id }
    const [jobs, total] = await Promise.all([
      SavedJob.find(filter).sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * LIST_PAGE_SIZE).limit(LIST_PAGE_SIZE).maxTimeMS(5000),
      SavedJob.countDocuments(filter).maxTimeMS(5000),
    ])
    res.set({
      'X-Total-Count': String(total),
      'X-Has-More': String(page * LIST_PAGE_SIZE < total),
      'X-Page': String(page),
    })
    return res.json(jobs)
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

router.delete('/:jobId', auth, async (req, res) => {
  if (!isText(req.params.jobId, 200)) return res.status(400).json({ message: 'Invalid job ID' })
  try {
    await SavedJob.findOneAndDelete({ user: req.user.id, jobId: req.params.jobId })
    return res.json({ message: 'Job removed!' })
  } catch {
    return res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
