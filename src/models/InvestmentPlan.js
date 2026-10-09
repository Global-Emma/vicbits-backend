const mongoose = require('mongoose');

const investmentPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    category: {
      type: String,
      enum: ['crypto', 'realestate', 'gold', 'etfs', 'nfts'],
      required: true,
    },
    price: { type: Number, default: 0, min: 0 },
    change24h: { type: Number, default: 0 },
    yieldType: {
      type: String,
      enum: ['weekly', 'monthly'],
      required: true,
    },
    yieldPercent: { type: Number, required: true, min: 0 },
    payoutIntervalDays: { type: Number, required: true, min: 1 },
    payoutDate: { type: Date, default: null },
    minInvestment: { type: Number, required: true, min: 0 },
    expectedReturns: { type: Number, required: true, min: 0 },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    badge: { type: String, trim: true, default: null },
    description: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InvestmentPlan', investmentPlanSchema);