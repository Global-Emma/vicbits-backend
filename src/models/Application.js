const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  proposal: {
    type: String,
    required: true,
  },
  bid: {
    type: Number,
    required: true,
  },
  delivery: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  cv: {
    type: String, // URL to the uploaded CV
  },
  message: {
    type: String,
  },

}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);