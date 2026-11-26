const mongoose = require('mongoose')

const interviewEvaluationSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 10, required: true },
  whatWentWell: { type: [String], default: [] },
  improvements: { type: [String], default: [] },
  sampleAnswer: { type: String, required: true, maxlength: 8000 },
  missingConcepts: { type: [String], default: [] },
  scoreContext: { type: String, required: true, maxlength: 2000 },
}, { _id: false })

const responseSchema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 2000 },
  answer: { type: String, required: true, maxlength: 8000 },
  category: { type: String, enum: ['technical', 'behavioral', 'hr'], required: true },
  evaluation: { type: interviewEvaluationSchema, required: true },
}, { _id: false })

const reportSchema = new mongoose.Schema({
  overallScore: { type: Number, min: 0, max: 100, required: true },
  strongestAreas: { type: [String], default: [] },
  weakAreas: { type: [String], default: [] },
  communicationFeedback: { type: String, required: true, maxlength: 2000 },
  answerStructureFeedback: { type: String, required: true, maxlength: 2000 },
  topicsToRevise: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },
}, { _id: false })

const interviewSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true, trim: true, maxlength: 200 },
  experience: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, enum: ['technical', 'behavioral', 'hr'], required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  responses: { type: [responseSchema], required: true, validate: (items) => items.length >= 1 && items.length <= 12 },
  report: { type: reportSchema, required: true },
}, { timestamps: true })

interviewSessionSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('InterviewSession', interviewSessionSchema)
