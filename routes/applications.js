const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const TrackedApplication = require('../models/TrackedApplication')
const auth = require('../middleware/auth')

const STATUSES = TrackedApplication.APPLICATION_STATUSES
const SOURCES = ['adzuna', 'recruiter', 'sample', 'manual']
const LIST_PAGE_SIZE = 50
const MAX_LIST_PAGE = 10000
const isText = (value, maxLength, required = false) => (
  typeof value === 'string' && value.length <= maxLength && (!required || value.trim().length > 0)
)
const normalizeJobId = (value) => (
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    ? String(value).trim()
    : ''
)
const parseDate = (value) => {
  if (value === undefined || value === null || value === '') return new Date()
  if (typeof value !== 'string') return null
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value)
  if (!dateMatch) return null
  const [, yearText, monthText, dayText] = dateMatch
  const calendarDate = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)))
  if (calendarDate.getUTCFullYear() !== Number(yearText) ||
      calendarDate.getUTCMonth() !== Number(monthText) - 1 ||
      calendarDate.getUTCDate() !== Number(dayText)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000 ? null : date
}
const isSafeJobUrl = (value) => {
  if (value === undefined || value === '') return true
  if (!isText(value, 2048)) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const serializeApplication = (application) => {
  const result = application.toObject ? application.toObject() : { ...application }
  delete result.user
  return result
}

router.use(auth)

router.get('/', async (req, res) => {
  const { status, search } = req.query
  const pageText = req.query.page === undefined ? '1' : req.query.page
  const page = typeof pageText === 'string' && /^\d+$/.test(pageText) ? Number(pageText) : NaN
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_LIST_PAGE) {
    return res.status(400).json({ message: 'Page must be an integer between 1 and 10000' })
  }
  if ((status !== undefined && !STATUSES.includes(status)) ||
      (search !== undefined && (typeof search !== 'string' || search.trim().length > 100))) {
    return res.status(400).json({ message: 'Invalid application filter' })
  }

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const filter = { user: userId }
    if (status) filter.status = status
    const searchText = typeof search === 'string' ? search.trim() : ''
    if (searchText) {
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { company: { $regex: escapedSearch, $options: 'i' } },
      ]
    }

    const [applications, total, filteredTotal, groupedCounts] = await Promise.all([
      TrackedApplication.find(filter).select('-user').sort({ applicationDate: -1, createdAt: -1 })
        .skip((page - 1) * LIST_PAGE_SIZE).limit(LIST_PAGE_SIZE).maxTimeMS(5000).lean(),
      TrackedApplication.countDocuments({ user: userId }).maxTimeMS(5000),
      TrackedApplication.countDocuments(filter).maxTimeMS(5000),
      TrackedApplication.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 5000 }),
    ])
    const counts = Object.fromEntries(STATUSES.map((value) => [value, 0]))
    for (const item of groupedCounts) counts[item._id] = item.count
    return res.json({
      applications,
      total,
      filteredTotal,
      counts,
      page,
      pageSize: LIST_PAGE_SIZE,
      hasMore: page * LIST_PAGE_SIZE < filteredTotal,
    })
  } catch {
    return res.status(500).json({ message: 'Unable to load applications' })
  }
})

router.post('/', async (req, res) => {
  const body = req.body
  if (!isPlainObject(body)) return res.status(400).json({ message: 'Invalid application details' })

  const source = body.source === undefined ? 'manual' : body.source
  const jobId = body.jobId === undefined || body.jobId === null ? '' : normalizeJobId(body.jobId)
  const applicationDate = parseDate(body.applicationDate)
  const status = body.status === undefined ? 'Interested' : body.status
  if (!SOURCES.includes(source) || !isText(body.title, 200, true) || !isText(body.company, 200, true) ||
      !isText(body.location ?? '', 200) || !isSafeJobUrl(body.jobUrl) ||
      !isText(body.notes ?? '', 4000) || !applicationDate || !STATUSES.includes(status) ||
      (source !== 'manual' && (!jobId || jobId.length > 200)) ||
      (source === 'manual' && body.jobId !== undefined && body.jobId !== null && jobId)) {
    return res.status(400).json({ message: 'Invalid application details' })
  }

  try {
    if (source !== 'manual') {
      const existing = await TrackedApplication.exists({ user: req.user.id, source, jobId })
      if (existing) return res.status(409).json({ message: 'This job is already in your application tracker' })
    }

    const application = await TrackedApplication.create({
      user: req.user.id,
      ...(source !== 'manual' ? { jobId } : {}),
      source,
      title: body.title.trim(),
      company: body.company.trim(),
      location: (body.location || '').trim(),
      jobUrl: (body.jobUrl || '').trim(),
      applicationDate,
      notes: (body.notes || '').trim(),
      status,
      statusHistory: [{ status, changedAt: new Date() }],
    })
    return res.status(201).json(serializeApplication(application))
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This job is already in your application tracker' })
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid application details' })
    return res.status(500).json({ message: 'Unable to create application' })
  }
})

router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Application not found' })
  try {
    const application = await TrackedApplication.findOne({ _id: req.params.id, user: req.user.id }).select('-user').lean()
    if (!application) return res.status(404).json({ message: 'Application not found' })
    return res.json(serializeApplication(application))
  } catch {
    return res.status(500).json({ message: 'Unable to load application' })
  }
})

router.patch('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Application not found' })
  const body = req.body
  const allowedFields = ['title', 'company', 'location', 'jobUrl', 'applicationDate', 'notes', 'status']
  if (!isPlainObject(body) || Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowedFields.includes(key))) {
    return res.status(400).json({ message: 'Invalid application update' })
  }

  const update = {}
  for (const field of ['title', 'company']) {
    if (field in body) {
      if (!isText(body[field], 200, true)) return res.status(400).json({ message: 'Invalid application update' })
      update[field] = body[field].trim()
    }
  }
  if ('location' in body) {
    if (!isText(body.location, 200)) return res.status(400).json({ message: 'Invalid application update' })
    update.location = body.location.trim()
  }
  if ('jobUrl' in body) {
    if (!isSafeJobUrl(body.jobUrl)) return res.status(400).json({ message: 'Job URL must be a valid HTTP or HTTPS address' })
    update.jobUrl = (body.jobUrl || '').trim()
  }
  if ('notes' in body) {
    if (!isText(body.notes, 4000)) return res.status(400).json({ message: 'Invalid application update' })
    update.notes = body.notes.trim()
  }
  if ('applicationDate' in body) {
    const applicationDate = parseDate(body.applicationDate)
    if (!applicationDate) return res.status(400).json({ message: 'Invalid application date' })
    update.applicationDate = applicationDate
  }
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return res.status(400).json({ message: 'Invalid application status' })
    update.status = body.status
  }

  try {
    const application = await TrackedApplication.findOne({ _id: req.params.id, user: req.user.id })
    if (!application) return res.status(404).json({ message: 'Application not found' })
    if (update.status && update.status !== application.status) {
      application.statusHistory.push({ status: update.status, changedAt: new Date() })
      if (application.statusHistory.length > 50) application.statusHistory.splice(0, application.statusHistory.length - 50)
    }
    Object.assign(application, update)
    await application.save()
    return res.json(serializeApplication(application))
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid application update' })
    return res.status(500).json({ message: 'Unable to update application' })
  }
})

router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Application not found' })
  try {
    const application = await TrackedApplication.findOneAndDelete({ _id: req.params.id, user: req.user.id })
    if (!application) return res.status(404).json({ message: 'Application not found' })
    return res.json({ message: 'Application deleted' })
  } catch {
    return res.status(500).json({ message: 'Unable to delete application' })
  }
})

module.exports = router
