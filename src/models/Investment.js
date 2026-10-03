const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestmentPlan', required: true },
    planSlug: { type: String, required: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    category: { type: String, required: true },
    investedAmount: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },
    expectedApy: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Matured', 'Locked'], default: 'Active' },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Investment', investmentSchema);
