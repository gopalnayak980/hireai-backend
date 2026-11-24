const express = require('express')
const router = express.Router()
const { embedTexts, rankBySimilarity, EMBEDDING_MODEL } = require('../services/embeddings')

const MAX_JOBS = 50

/**
 * POST /api/semantic/match
 * body: { resumeText: string, jobs: [{ id, title, company, description, ... }] }
 * Embeds the resume (query) and every job (document), then ranks jobs by cosine similarity.
 */
router.post('/match', async (req, res) => {
  try {
    const { resumeText, jobs } = req.body

    if (!resumeText || String(resumeText).trim().length < 30) {
      return res.status(400).json({ message: 'Please provide resume text (at least a few lines).' })
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ message: 'Please provide a non-empty jobs array.' })
    }
    if (jobs.length > MAX_JOBS) {
      return res.status(400).json({ message: `At most ${MAX_JOBS} jobs per request.` })
    }

    const jobTexts = jobs.map((j) => `${j.title || ''}. ${j.company || ''}. ${j.description || ''}`)
    const [[resumeVec], jobVecs] = await Promise.all([
      embedTexts([resumeText], 'query'),
      embedTexts(jobTexts, 'document'),
    ])

    const ranked = rankBySimilarity(resumeVec, jobs, jobVecs)
    res.json({ model: EMBEDDING_MODEL, count: ranked.length, jobs: ranked })
  } catch (err) {
    console.error('Semantic match error:', err.message)
    res.status(500).json({ message: 'Semantic matching failed', error: err.message })
  }
})

module.exports = router
