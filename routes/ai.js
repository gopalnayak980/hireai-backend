const express = require('express')
const router = express.Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')
const auth = require('../middleware/auth')
const aiRateLimit = require('../middleware/aiRateLimit')
const createIpRateLimit = require('../middleware/ipRateLimit')

const MAX_RESUME_LENGTH = 20000
const MAX_JOB_DESCRIPTION_LENGTH = 12000
const MAX_TEXT_LENGTH = 2000
const GEMINI_TIMEOUT_MS = 25000
const isText = (value, maxLength) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
const aiIpRateLimit = createIpRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'AI request limit reached for this network. Please try again later.',
})

const getModel = () => {
  if (!process.env.GEMINI_API_KEY) return null
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' })
}

const parseJsonResponse = (responseText) => {
  const cleaned = responseText.replace(/```(?:json)?/gi, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)
}

const validStringList = (value, maxItems = 20) => (
  Array.isArray(value) && value.length <= maxItems && value.every((item) => isText(item, MAX_TEXT_LENGTH))
)

router.post('/match', auth, aiRateLimit, aiIpRateLimit, async (req, res) => {
  const { resumeText, jobTitle, jobDescription, skills } = req.body || {}
  const validSkills = Array.isArray(skills)
    ? skills.length >= 1 && skills.length <= 50 && skills.every((skill) => isText(skill, 100))
    : isText(skills, 2000)

  if (!isText(resumeText, MAX_RESUME_LENGTH) || !isText(jobTitle, 200) ||
      !isText(jobDescription, MAX_JOB_DESCRIPTION_LENGTH) || !validSkills) {
    return res.status(400).json({ message: 'Valid resume text, job title, description, and skills are required' })
  }

  try {
    const model = getModel()
    if (!model) return res.status(503).json({ message: 'AI service is not configured' })
    const prompt = `
You are an expert HR and resume analyzer.

Analyze this resume against the job and respond in this EXACT JSON format only:
{
  "matchScore": 75,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "missing": ["missing skill 1", "missing skill 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "verdict": "Good match! You should apply."
}

JOB TITLE: ${jobTitle.trim()}
JOB DESCRIPTION: ${jobDescription.trim()}
REQUIRED SKILLS: ${Array.isArray(skills) ? skills.join(', ') : skills}

RESUME:
${resumeText.trim()}

Respond with JSON only, no extra text.
`

    const result = await model.generateContent(prompt, { timeout: GEMINI_TIMEOUT_MS })
    const parsed = parseJsonResponse(result.response.text())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        !Number.isFinite(parsed.matchScore) || parsed.matchScore < 0 || parsed.matchScore > 100 ||
        !validStringList(parsed.strengths) || !validStringList(parsed.missing) ||
        !validStringList(parsed.suggestions) || !isText(parsed.verdict, MAX_TEXT_LENGTH)) {
      return res.status(502).json({ message: 'AI analysis returned an invalid response. Please try again.' })
    }
    return res.json({
      matchScore: parsed.matchScore,
      strengths: parsed.strengths,
      missing: parsed.missing,
      suggestions: parsed.suggestions,
      verdict: parsed.verdict,
    })
  } catch {
    return res.status(502).json({ message: 'AI analysis is temporarily unavailable' })
  }
})

router.post('/interview', auth, aiRateLimit, aiIpRateLimit, async (req, res) => {
  const { role, experience } = req.body || {}
  if (!isText(role, 200) || !isText(experience, 100)) {
    return res.status(400).json({ message: 'A valid role and experience level are required' })
  }

  try {
    const model = getModel()
    if (!model) return res.status(503).json({ message: 'AI service is not configured' })
    const prompt = `
You are an expert technical interviewer.

Generate 8 interview questions with detailed answers for:
Role: ${role.trim()}
Experience Level: ${experience.trim()}

Respond in this EXACT JSON format only:
{
  "questions": [
    {
      "question": "What is...",
      "answer": "Detailed answer here...",
      "tip": "Interview tip here"
    }
  ]
}

Mix of: technical concepts, practical scenarios, problem solving.
JSON only, no extra text.
`

    const result = await model.generateContent(prompt, { timeout: GEMINI_TIMEOUT_MS })
    const parsed = parseJsonResponse(result.response.text())
    const validQuestions = parsed && Array.isArray(parsed.questions) &&
      parsed.questions.length >= 1 && parsed.questions.length <= 12 &&
      parsed.questions.every((question) => question && typeof question === 'object' &&
        isText(question.question, MAX_TEXT_LENGTH) && isText(question.answer, MAX_TEXT_LENGTH) &&
        isText(question.tip, MAX_TEXT_LENGTH))
    if (!validQuestions) {
      return res.status(502).json({ message: 'AI returned an invalid question set. Please try again.' })
    }
    return res.json({ questions: parsed.questions })
  } catch {
    return res.status(502).json({ message: 'Interview question generation is temporarily unavailable' })
  }
})

module.exports = router
