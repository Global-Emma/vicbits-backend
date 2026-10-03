const InvestmentPlan = require('../models/InvestmentPlan');
const SiteContent = require('../models/SiteContent');
const ContactInquiry = require('../models/ContactInquiry');
const User = require('../models/User');
const Investment = require('../models/Investment');

const getPublicContent = async (_req, res) => {
  try {
    const [content, plans, userCount, investmentSummary] = await Promise.all([
      SiteContent.findOne({ key: 'public' }).lean(),
      InvestmentPlan.find({ active: true }).sort({ createdAt: 1 }).lean(),
      User.countDocuments(),
      Investment.aggregate([{ $match: { status: 'Active' } }, { $group: { _id: null, totalValue: { $sum: '$currentValue' } } }]),
    ]);
    const publishedContent = content || { assetRates: [], testimonials: [], faqs: [] };
    res.json({
      success: true,
      data: {
        assetRates: publishedContent.assetRates || [],
        testimonials: (publishedContent.testimonials || []).filter((item) => item.published),
        faqs: (publishedContent.faqs || []).filter((item) => item.published),
        plans,
        metrics: {
          investorCount: userCount,
          assetsManaged: investmentSummary[0]?.totalValue || 0,
          averageExpectedApy: plans.length
            ? plans.reduce((sum, plan) => sum + plan.expectedApy, 0) / plans.length
            : 0,
        },
        marketData: plans.filter((plan) => plan.price > 0).map((plan) => ({
          symbol: `${plan.symbol}/USD`,
          name: plan.name,
          price: plan.price,
          change: `${plan.change24h >= 0 ? '+' : ''}${plan.change24h}%`,
          isUp: plan.change24h >= 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load public content.' });
  }
};

const updatePublicContent = async (req, res) => {
  const updates = {};
  for (const field of ['assetRates', 'testimonials', 'faqs']) {
    if (Array.isArray(req.body[field])) updates[field] = req.body[field];
  }
  try {
    const content = await SiteContent.findOneAndUpdate(
      { key: 'public' },
      { $set: updates, $setOnInsert: { key: 'public' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Could not save public content.', error: error.message });
  }
};

const createContactInquiry = async (req, res) => {
  const { fullName, email, phone, interest, message } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }
  try {
    const inquiry = await ContactInquiry.create({ fullName, email, phone, interest, message });
    res.status(201).json({ success: true, message: 'Your inquiry has been received.', data: { id: inquiry._id } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Could not save your inquiry.' });
  }
};

const listContactInquiries = async (_req, res) => {
  try {
    const inquiries = await ContactInquiry.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: inquiries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load contact inquiries.' });
  }
};

module.exports = { getPublicContent, updatePublicContent, createContactInquiry, listContactInquiries };
