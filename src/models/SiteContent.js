const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'public', unique: true },
    assetRates: [{
      key: { type: String, required: true, trim: true },
      name: { type: String, required: true, trim: true },
      annualApy: { type: Number, required: true, min: 0 },
      badge: { type: String, default: '', trim: true },
    }],
    testimonials: [{
      name: { type: String, required: true, trim: true },
      title: { type: String, default: '', trim: true },
      location: { type: String, default: '', trim: true },
      avatar: { type: String, default: '', trim: true },
      rating: { type: Number, min: 1, max: 5, default: 5 },
      asset: { type: String, default: '', trim: true },
      quote: { type: String, required: true, trim: true },
      published: { type: Boolean, default: false },
    }],
    faqs: [{
      question: { type: String, required: true, trim: true },
      answer: { type: String, required: true, trim: true },
      published: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
