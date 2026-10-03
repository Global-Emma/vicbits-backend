const mongoose = require('mongoose');

const contactInquirySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    interest: { type: String, trim: true, maxlength: 120, default: '' },
    message: { type: String, trim: true, maxlength: 5000, default: '' },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactInquiry', contactInquirySchema);
