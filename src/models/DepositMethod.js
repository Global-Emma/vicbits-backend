const mongoose = require('mongoose');

const depositMethodSchema = new mongoose.Schema(
  {
    asset: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    network: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    minimumUsdAmount: { type: Number, default: 0, min: 0 },
    confirmations: { type: Number, default: 1, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

depositMethodSchema.index({ asset: 1, network: 1 }, { unique: true });

module.exports = mongoose.model('DepositMethod', depositMethodSchema);
