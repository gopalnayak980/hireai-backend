const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const InterviewSession = require('../models/InterviewSession')
const auth = require('../middleware/auth')
const aiRateLimit = require('../middleware/aiRateLimit')
const createIpRateLimit = require('../middleware/ipRateLimit')

const STATUSES = ['technical', 'behavioral', 'hr']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const HISTORY_PAGE_SIZE = 20
const isText = (value, maxLength) => typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
const validList = (value) => Array.isArray(value) && value.length <= 20 && value.every((item) => isText(item, 2000))
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const validEvaluation = (value) => isPlainObject(value) && Number.isFinite(value.score) && value.score >= 0 && value.score <= 10 &&
  validList(value.whatWentWell) && validList(value.improvements) && isText(value.sampleAnswer, 8000) &&
  validList(value.missingConcepts) && isText(value.scoreContext, 2000)
const validReport = (value) => isPlainObject(value) && Number.isFinite(value.overallScore) &&
  value.overallScore >= 0 && value.overallScore <= 100 && validList(value.strongestAreas) &&
  validList(value.weakAreas) && isText(value.communicationFeedback, 2000) &&
  isText(value.answerStructureFeedback, 2000) && validList(value.topicsToRevise) && validList(value.recommendations)
const safeSession = (session) => {
  const result = session.toObject ? session.toObject() : { ...session }
  delete result.user
  return result
}
const sessionWriteIpRateLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'Interview session write limit reached for this network. Please try again later.',
})

router.use(auth)

router.get('/', async (req, res) => {
  const pageText = req.query.page === undefined ? '1' : req.query.page
  const page = typeof pageText === 'string' && /^\d+$/.test(pageText) ? Number(pageText) : NaN
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
    return res.status(400).json({ message: 'Page must be a positive integer' })
  }
  try {
    const filter = { user: req.user.id }
    const [sessions, total] = await Promise.all([
      InterviewSession.find(filter)
        .select('role experience category difficulty report.overallScore createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * HISTORY_PAGE_SIZE)
        .limit(HISTORY_PAGE_SIZE)
        .lean(),
      InterviewSession.countDocuments(filter),
    ])
    return res.json({ sessions, total, page, pageSize: HISTORY_PAGE_SIZE, hasMore: page * HISTORY_PAGE_SIZE < total })
  } catch {
    return res.status(500).json({ message: 'Unable to load interview history' })
  }
})

router.post('/', aiRateLimit, sessionWriteIpRateLimit, async (req, res) => {
  const body = req.body
  const responses = body?.responses
  const validResponses = Array.isArray(responses) && responses.length >= 1 && responses.length <= 12 &&
    responses.every((entry) => isPlainObject(entry) && isText(entry.question, 2000) &&
      isText(entry.answer, 8000) && STATUSES.includes(entry.category) && validEvaluation(entry.evaluation))
  if (!isPlainObject(body) || !isText(body.role, 200) || !isText(body.experience, 100) ||
      !STATUSES.includes(body.category) || !DIFFICULTIES.includes(body.difficulty) ||
      !validResponses || !validReport(body.report)) {
    return res.status(400).json({ message: 'Invalid completed interview session' })
  }

  try {
    const session = await InterviewSession.create({
      user: req.user.id,
      role: body.role.trim(),
      experience: body.experience.trim(),
      category: body.category,
      difficulty: body.difficulty,
      responses: responses.map((entry) => ({
        question: entry.question.trim(),
        answer: entry.answer.trim(),
        category: entry.category,
        evaluation: {
          score: entry.evaluation.score,
          whatWentWell: entry.evaluation.whatWentWell,
          improvements: entry.evaluation.improvements,
          sampleAnswer: entry.evaluation.sampleAnswer.trim(),
          missingConcepts: entry.evaluation.missingConcepts,
          scoreContext: entry.evaluation.scoreContext.trim(),
        },
      })),
      report: {
        overallScore: body.report.overallScore,
        strongestAreas: body.report.strongestAreas,
        weakAreas: body.report.weakAreas,
        communicationFeedback: body.report.communicationFeedback.trim(),
        answerStructureFeedback: body.report.answerStructureFeedback.trim(),
        topicsToRevise: body.report.topicsToRevise,
        recommendations: body.report.recommendations,
      },
    })
    return res.status(201).json(safeSession(session))
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid completed interview session' })
    return res.status(500).json({ message: 'Unable to save interview session' })
  }
})

router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Interview session not found' })
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id }).select('-user').lean()
    if (!session) return res.status(404).json({ message: 'Interview session not found' })
    return res.json(safeSession(session))
  } catch {
    return res.status(500).json({ message: 'Unable to load interview session' })
  }
})

router.delete('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Interview session not found' })
  try {
    const session = await InterviewSession.findOneAndDelete({ _id: req.params.id, user: req.user.id })
    if (!session) return res.status(404).json({ message: 'Interview session not found' })
    return res.json({ message: 'Interview session deleted' })
  } catch {
    return res.status(500).json({ message: 'Unable to delete interview session' })
  }
})

module.exports = router
