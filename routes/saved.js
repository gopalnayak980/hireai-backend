const express = require('express')
const router = express.Router()
const SavedJob = require('../models/SavedJob')
const auth = require('../middleware/auth')

const isText = (value, maxLength) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
const optionalText = (value, maxLength) => value === undefined || value === '' || (typeof value === 'string' && value.length <= maxLength)

router.post('/', auth, async (req, res) => {
  const { jobId, title, company, location, salary, url } = req.body || {}
  const normalizedJobId = (typeof jobId === 'string' || (typeof jobId === 'number' && Number.isFinite(jobId)))
    ? String(jobId).trim()
    : ''
  if (!isText(normalizedJobId, 200) || !isText(title, 200) || !isText(company, 200) ||
      !optionalText(location, 200) || !optionalText(salary, 100) || !optionalText(url, 2048)) {
    return res.status(400).json({ message: 'Invalid saved job details' })
  }

  try {
    const saved = await SavedJob.create({
      user: req.user.id,
      jobId: normalizedJobId,
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
  try {
    const jobs = await SavedJob.find({ user: req.user.id }).sort({ createdAt: -1 })
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
