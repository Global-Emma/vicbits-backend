const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reference: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['Income', 'Expense', 'Transfer', 'Refund'], required: true },
    status: { type: String, enum: ['Completed', 'Pending', 'Failed'], default: 'Pending' },
    eventType: { type: String, enum: ['deposit', 'withdrawal', 'investment', 'adjustment'], required: true },
    paymentMethod: { type: String, default: 'Account balance' },
    fee: { type: Number, default: 0, min: 0 },
    senderRecipient: { type: String, default: '' },
    asset: { type: String, default: '' },
    destination: { type: String, default: '' },
    externalReference: { type: String, default: '', trim: true },
    planSlug: { type: String, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ eventType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
