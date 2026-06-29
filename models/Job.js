const mongoose = require('mongoose')

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String },
  type: { type: String, enum: ['Full Time', 'Remote', 'Part Time'], default: 'Full Time' },
  skills: [String],
  description: { type: String },
  experience: { type: String },
  openings: { type: Number, default: 1 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

module.exports = mongoose.model('Job', jobSchema)