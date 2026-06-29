const express = require('express')
const router = express.Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

router.post('/match', async (req, res) => {
  try {
    const { resumeText, jobTitle, jobDescription, skills } = req.body

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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
REQUIRED SKILLS: ${skills.join(', ')}

RESUME:
${resumeText}

Respond with JSON only, no extra text.
`

    const result = await model.generateContent(prompt)
    const response = result.response.text()
    console.log('AI Response:', response)

    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    res.json(parsed)
  } catch (err) {
    console.error('AI Error:', err.message)
    res.status(500).json({ message: 'AI analysis failed', error: err.message })
  }
})

module.exports = router