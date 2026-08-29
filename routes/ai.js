const express = require('express')
const router = express.Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

router.post('/match', async (req, res) => {
  try {
    const { resumeText, jobTitle, jobDescription, skills } = req.body

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
    const model = genAI.getGenerativeModel({ model: modelName })

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

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription}
REQUIRED SKILLS: ${Array.isArray(skills) ? skills.join(', ') : skills}

RESUME:
${resumeText}

Respond with JSON only, no extra text.
`

    const result = await model.generateContent(prompt)
    const response = result.response.text()
    console.log('AI Response:', response)

    const cleaned = response.replace(/```json|```/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)

    res.json(parsed)
  } catch (err) {
    console.error('AI Error:', err.message)
    res.status(500).json({ message: 'AI analysis failed', error: err.message })
  }
})
router.post('/interview', async (req, res) => {
  try {
    const { role, experience } = req.body

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
    const model = genAI.getGenerativeModel({ model: modelName })

    const prompt = `
You are an expert technical interviewer.

Generate 8 interview questions with detailed answers for:
Role: ${role}
Experience Level: ${experience}

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

    const result = await model.generateContent(prompt)
    const response = result.response.text()
    const cleaned = response.replace(/```json|```/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)

    res.json(parsed)
  } catch (err) {
    console.error('Interview AI Error:', err.message)
    res.status(500).json({ message: 'Failed to generate questions', error: err.message })
  }
})

module.exports = router