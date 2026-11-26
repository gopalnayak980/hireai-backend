const mongoose = require('mongoose')

const APPLICATION_STATUSES = [
  'Interested',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
]

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: APPLICATION_STATUSES, required: true },
  changedAt: { type: Date, required: true, default: Date.now },
}, { _id: false })

const trackedApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: String, trim: true, maxlength: 200 },
  source: { type: String, enum: ['adzuna', 'recruiter', 'sample', 'manual'], required: true, default: 'manual' },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  company: { type: String, required: true, trim: true, maxlength: 200 },
  location: { type: String, trim: true, maxlength: 200, default: '' },
  jobUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  applicationDate: { type: Date, required: true, default: Date.now },
  notes: { type: String, maxlength: 4000, default: '' },
  status: { type: String, enum: APPLICATION_STATUSES, required: true, default: 'Interested' },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true })

trackedApplicationSchema.index(
  { user: 1, source: 1, jobId: 1 },
  { unique: true, partialFilterExpression: { jobId: { $type: 'string' } } },
)
trackedApplicationSchema.index({ user: 1, applicationDate: -1, createdAt: -1 })

module.exports = mongoose.model('TrackedApplication', trackedApplicationSchema)
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES
