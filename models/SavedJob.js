const mongoose = require('mongoose')

const savedJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: String, required: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String },
  salary: { type: String },
  url: { type: String },
}, { timestamps: true })

module.exports = mongoose.model('SavedJob', savedJobSchema)