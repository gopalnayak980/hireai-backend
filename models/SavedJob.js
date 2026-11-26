const mongoose = require('mongoose')

const savedJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: String, required: true },
  source: { type: String, enum: ['adzuna', 'recruiter', 'sample'] },
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String },
  salary: { type: String },
  url: { type: String },
}, { timestamps: true })

savedJobSchema.index({ user: 1, jobId: 1 }, { unique: true })
savedJobSchema.index({ user: 1, createdAt: -1, _id: -1 })

module.exports = mongoose.model('SavedJob', savedJobSchema)
