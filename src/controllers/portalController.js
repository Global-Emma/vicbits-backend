const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const InvestmentPlan = require('../models/InvestmentPlan');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const DepositMethod = require('../models/DepositMethod');
const cloudinary = require('../config/cloudinary');
const { invalidateCache } = require('../utils/validation');

const ASSETS_DATA = [
  {
    name: "Bitcoin Vault",
    slug: "btc",
    symbol: "BTC",
    category: "crypto",
    price: 94500,
    change24h: 3.85,
    yieldType: "weekly",
    yieldPercent: 45,
    payoutIntervalDays: 7,
    minInvestment: 50,
    expectedReturns: 72.5,
    riskLevel: "Medium",
    badge: "Most Popular",
    description: "Institutional-grade cold storage Bitcoin liquidity pool with automated yield compounding.",
    tags: ["Layer-1", "Store of Value"],
    active: true,
  },
  {
    name: "Dubai Marina Commercial REIT",
    slug: "dubai-reit",
    symbol: "DXB-REIT",
    category: "realestate",
    price: 500,
    change24h: 0.82,
    yieldType: "monthly",
    yieldPercent: 52,
    payoutIntervalDays: 30,
    minInvestment: 500,
    expectedReturns: 760,
    riskLevel: "Low",
    badge: "High Yield",
    description: "Fractional ownership in prime Dubai commercial real estate with regular dividend payouts.",
    tags: ["Fractional Property", "Dividends"],
    active: true,
  },
  {
    name: "Swiss Vault Physical Gold",
    slug: "gold-vault",
    symbol: "XAU-GLD",
    category: "gold",
    price: 2680,
    change24h: 1.15,
    yieldType: "monthly",
    yieldPercent: 40,
    payoutIntervalDays: 30,
    minInvestment: 100,
    expectedReturns: 140,
    riskLevel: "Low",
    badge: "Inflation Shield",
    description: "100% allocated physical gold stored in Zurich vaults, audited monthly with full redemption rights.",
    tags: ["Physical Gold", "Zurich Vault"],
    active: true,
  },
  {
    name: "Vanguard S&P 500 Index ETF",
    slug: "sp500-etf",
    symbol: "VOO",
    category: "etfs",
    price: 512.4,
    change24h: -0.34,
    yieldType: "weekly",
    yieldPercent: 42,
    payoutIntervalDays: 7,
    minInvestment: 100,
    expectedReturns: 142,
    riskLevel: "Low",
    badge: null,
    description: "Track the top 500 US public equities with low management fees and steady growth history.",
    tags: ["Index Fund", "US Equities"],
    active: true,
  },
  {
    name: "Ethereum Staking Pool",
    slug: "eth-staking",
    symbol: "ETH",
    category: "crypto",
    price: 3450,
    change24h: 5.12,
    yieldType: "weekly",
    yieldPercent: 58,
    payoutIntervalDays: 7,
    minInvestment: 100,
    expectedReturns: 158,
    riskLevel: "Medium",
    badge: "Trending",
    description: "Liquidity-backed proof-of-stake node validation yielding direct protocol rewards.",
    tags: ["DeFi", "Smart Contracts"],
    active: true,
  },
  {
    name: "VicBits Apex Access NFT",
    slug: "vicbits-nft-pass",
    symbol: "VB-APEX",
    category: "nfts",
    price: 3800,
    change24h: 14.8,
    yieldType: "weekly",
    yieldPercent: 60,
    payoutIntervalDays: 7,
    minInvestment: 3800,
    expectedReturns: 6080,
    riskLevel: "High",
    badge: "Exclusive",
    description: "VIP Tier membership pass unlocking zero-fee trading, private ICO access, and revenue shares.",
    tags: ["VIP Pass", "Revenue Share"],
    active: true,
  },
  {
    name: "Global Tech & AI Innovation ETF",
    slug: "ai-tech-etf",
    symbol: "AITECH",
    category: "etfs",
    price: 210.15,
    change24h: 2.94,
    yieldType: "monthly",
    yieldPercent: 55,
    payoutIntervalDays: 30,
    minInvestment: 100,
    expectedReturns: 155,
    riskLevel: "High",
    badge: null,
    description: "Diversified exposure to leading semi-conductor, AI software, and robotics companies worldwide.",
    tags: ["AI Technology", "High Growth"],
    active: true,
  },
  {
    name: "Manhattan Tech Center Development",
    slug: "manhattan-hub",
    symbol: "NYC-MHT",
    category: "realestate",
    price: 1000,
    change24h: 0.15,
    yieldType: "monthly",
    yieldPercent: 48,
    payoutIntervalDays: 30,
    minInvestment: 1000,
    expectedReturns: 1480,
    riskLevel: "Medium",
    badge: null,
    description: "Equity stake in a 42-story office and retail complex in downtown Manhattan, New York.",
    tags: ["Commercial", "US Property"],
    active: true,
  },
  {
    name: "Solana High-Yield Liquidity Node",
    slug: "sol-liquidity",
    symbol: "SOL-NODE",
    category: "crypto",
    price: 210,
    change24h: 8.45,
    yieldType: "weekly",
    yieldPercent: 50,
    payoutIntervalDays: 7,
    minInvestment: 200,
    expectedReturns: 300,
    riskLevel: "High",
    badge: "New Release",
    description: "DeFi liquidity provision on Solana DEX protocols with automated yield farming strategy.",
    tags: ["Solana", "DeFi Yield"],
    active: true,
  },
  {
    name: "London Luxury Residential Equity",
    slug: "london-property",
    symbol: "LDN-PROP",
    category: "realestate",
    price: 2500,
    change24h: 0.45,
    yieldType: "monthly",
    yieldPercent: 44,
    payoutIntervalDays: 30,
    minInvestment: 2500,
    expectedReturns: 3600,
    riskLevel: "Medium",
    badge: "Stable Dividend",
    description: "Prime Mayfair residential apartment refurbishment equity fund with asset-backed security.",
    tags: ["London Equity", "Residential Property"],
    active: true,
  },
];

// --- HELPER FUNCTIONS ---

const sendError = (res, status, message, error = null) => {
  const response = { success: false, message };
  if (error && process.env.NODE_ENV === 'development') {
    response.error = error;
  }
  return res.status(status).json(response);
};

const newReference = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

const adjustUserNumericField = async (userId, field, delta, minimumValue = -Infinity) => {
  if (!Number.isFinite(delta) || Number.isNaN(minimumValue)) {
    throw new Error('Balance adjustment values must be valid numbers.');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await User.collection.findOne(
      { _id: userId },
      { projection: { [field]: 1 } }
    );
    if (!user) return { matchedCount: 0, userNotFound: true };

    const currentValue = Number(user[field] ?? 0);
    if (!Number.isFinite(currentValue)) {
      throw new Error(`Investor ${field} is not a valid number.`);
    }
    if (currentValue + delta < minimumValue) {
      return { matchedCount: 0, insufficientBalance: true };
    }

    const fieldFilter = user[field] === undefined
      ? { [field]: { $exists: false } }
      : { [field]: user[field] };
    const result = await User.collection.updateOne(
      { _id: userId, ...fieldFilter },
      { $set: { [field]: currentValue + delta } }
    );

    if (result.matchedCount === 1) return result;
  }

  throw new Error(`Investor ${field} changed repeatedly; please retry the request.`);
};

const adjustUserBalance = (userId, delta, minimumBalance = -Infinity) => (
  adjustUserNumericField(userId, 'balance', delta, minimumBalance)
);
const incrementUserBalance = (userId, amount) => adjustUserBalance(userId, amount);

const creditInvestmentPayoutOnce = async (userId, investmentId, amount) => {
  const result = await User.collection.updateOne(
    { _id: userId, settledInvestmentPayouts: { $ne: investmentId } },
    {
      $inc: { balance: amount },
      $addToSet: { settledInvestmentPayouts: investmentId },
    }
  );
  if (result.matchedCount === 1) return;

  const user = await User.collection.findOne(
    { _id: userId },
    { projection: { settledInvestmentPayouts: 1 } }
  );
  if (!user) throw new Error(`Investor account for investment ${investmentId} was not found.`);
  if (user.settledInvestmentPayouts?.some((id) => id.toString() === investmentId.toString())) return;
  throw new Error(`Payout balance could not be updated for investment ${investmentId}.`);
};

const investmentValueAt = (investment, now = Date.now()) => {
  const principal = Number(investment.investedAmount || 0);
  const payoutAmount = Number(investment.payoutAmount ?? principal);
  const payoutDate = new Date(investment.payoutDate || investment.startDate || investment.createdAt || now).getTime();
  const startedAt = new Date(investment.startDate || investment.createdAt || now).getTime();
  const duration = Math.max(payoutDate - startedAt, 0);
  const progress = duration ? Math.min(Math.max((now - startedAt) / duration, 0), 1) : 1;
  return principal + (payoutAmount - principal) * progress;
};

const withCurrentInvestmentValue = (investment, now = Date.now()) => ({
  ...investment,
  currentValue: investmentValueAt(investment, now),
  payoutAmount: Number(investment.payoutAmount ?? investment.investedAmount ?? 0),
  totalProfit: investment.status === 'Active'
    ? investmentValueAt(investment, now) - Number(investment.investedAmount || 0)
    : Number(investment.realizedReturn ?? (
      Number(investment.payoutAmount ?? investment.investedAmount ?? 0)
        - Number(investment.investedAmount || 0)
    )),
});

let payoutSettlementInProgress = false;

const ensureActiveInvestmentTerms = async () => {
  const legacyInvestments = await Investment.find({
    status: { $in: ['Active', 'Matured'] },
    paidOutAt: null,
    $or: [
      { payoutDate: { $exists: false } },
      { payoutAmount: { $exists: false } },
      { expectedReturns: { $exists: false } },
      { yieldType: { $exists: false } },
      { yieldPercent: { $exists: false } },
    ],
  }).select('_id plan planSlug investedAmount currentValue expectedApy expectedReturns yieldType yieldPercent startDate createdAt payoutDate payoutAmount').lean();

  for (const investment of legacyInvestments) {
    const plan = investment.plan
      ? await InvestmentPlan.findById(investment.plan).lean()
      : await InvestmentPlan.findOne({ slug: investment.planSlug }).lean();

    const startDate = new Date(investment.startDate || investment.createdAt || Date.now());
    const configuredPayoutDate = plan?.payoutDate ? new Date(plan.payoutDate) : null;
    const payoutDate = configuredPayoutDate && configuredPayoutDate > startDate
      ? configuredPayoutDate
      : investment.payoutDate || new Date(
        startDate.getTime() + Number(plan?.payoutIntervalDays || (investment.yieldType === 'weekly' ? 7 : 30)) * 24 * 60 * 60 * 1000
      );
    const minimumInvestment = Number(plan?.minInvestment || 0);
    const payoutMultiple = minimumInvestment > 0
      ? Number(plan.expectedReturns) > 0
        ? Number(plan.expectedReturns) / minimumInvestment
        : 1 + Number(plan.yieldPercent || 0) / 100
      : 1 + Number(investment.yieldPercent ?? plan?.yieldPercent ?? investment.expectedApy ?? 0) / 100;
    const calculatedPlanPayout = Number((Number(investment.investedAmount || 0) * payoutMultiple).toFixed(2));
    const fallbackPayoutAmount = investment.expectedReturns
      ?? (plan
        ? calculatedPlanPayout
        : Number(investment.currentValue) > Number(investment.investedAmount)
          ? investment.currentValue
          : calculatedPlanPayout);
    const payoutAmount = investment.payoutAmount ?? fallbackPayoutAmount;
    const yieldType = investment.yieldType || plan?.yieldType || 'monthly';
    const yieldPercent = investment.yieldPercent ?? plan?.yieldPercent ?? investment.expectedApy ?? (
      Number(investment.investedAmount) > 0
        ? ((Number(payoutAmount) / Number(investment.investedAmount)) - 1) * 100
        : 0
    );
    const updates = {};
    if (!investment.payoutDate) updates.payoutDate = payoutDate;
    if (investment.payoutAmount === undefined || investment.payoutAmount === null) updates.payoutAmount = payoutAmount;
    updates.expectedReturns = payoutAmount;
    updates.yieldType = yieldType;
    updates.yieldPercent = yieldPercent;

    await Investment.updateOne(
      { _id: investment._id, status: { $in: ['Active', 'Matured'] }, paidOutAt: null },
      { $set: updates },
      { runValidators: true }
    );
  }
};

const settleDueInvestments = async (redisClient = null) => {
  if (payoutSettlementInProgress) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return settleDueInvestments(redisClient);
  }
  payoutSettlementInProgress = true;
  try {
    await ensureActiveInvestmentTerms();
    const now = new Date();
    const staleProcessingBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const dueInvestments = await Investment.find({
      status: 'Active',
      payoutDate: { $lte: now },
      paidOutAt: null,
    }).select('_id user investedAmount expectedReturns payoutAmount name symbol planSlug status').lean();
    const incompletePayouts = await Investment.find({
      status: 'Matured',
      paidOutAt: null,
      $or: [
        { payoutProcessingAt: { $exists: false } },
        { payoutProcessingAt: null },
        { payoutProcessingAt: { $lt: staleProcessingBefore } },
      ],
    }).select('_id user investedAmount expectedReturns payoutAmount name symbol planSlug status').lean();

    for (const due of [...dueInvestments, ...incompletePayouts]) {
      const principal = Number(due.investedAmount || 0);
      const payoutAmount = Number(due.payoutAmount ?? principal);
      const realizedReturn = payoutAmount - principal;
      const processingToken = crypto.randomBytes(16).toString('hex');
      const claimFilter = due.status === 'Matured'
        ? {
          _id: due._id,
          status: 'Matured',
          paidOutAt: null,
          $or: [
            { payoutProcessingAt: { $exists: false } },
            { payoutProcessingAt: null },
            { payoutProcessingAt: { $lt: staleProcessingBefore } },
          ],
        }
        : {
          _id: due._id,
          status: 'Active',
          payoutDate: { $lte: now },
          paidOutAt: null,
        };
      const claimed = await Investment.findOneAndUpdate(
        claimFilter,
        {
          $set: {
            status: 'Matured',
            currentValue: payoutAmount,
            realizedReturn,
            payoutProcessingAt: new Date(),
            payoutProcessingToken: processingToken,
          },
        },
        { returnDocument: 'after' }
      );
      if (!claimed) continue;

      try {
        await creditInvestmentPayoutOnce(due.user, due._id, payoutAmount);
        const reference = `PAY-${due._id}`;
        const existingTransaction = await Transaction.findOne({ reference }).lean();
        if (existingTransaction) {
          if (
            existingTransaction.user.toString() !== due.user.toString()
            || Number(existingTransaction.amount) !== payoutAmount
            || existingTransaction.category !== 'Investment Payout'
          ) {
            throw new Error(`Payout transaction reference conflicts with investment ${due._id}.`);
          }
        } else {
          await Transaction.create({
            user: due.user,
            reference,
            description: `Payout for ${due.name}: ${principal.toFixed(2)} capital + ${realizedReturn.toFixed(2)} returns`,
            category: 'Investment Payout',
            amount: payoutAmount,
            type: 'Income',
            status: 'Completed',
            eventType: 'investment',
            planSlug: due.planSlug,
            senderRecipient: due.name,
          });
        }
        const payoutUpdate = await Investment.updateOne(
          {
            _id: due._id,
            status: 'Matured',
            paidOutAt: null,
            payoutProcessingToken: processingToken,
          },
          {
            $set: { paidOutAt: new Date() },
            $unset: { payoutProcessingAt: '', payoutProcessingToken: '' },
          }
        );
        if (payoutUpdate.matchedCount !== 1) {
          throw new Error(`Payout completion could not be recorded for investment ${due._id}.`);
        }
        await invalidateCache(redisClient, `user:${due.user}`);
      } catch (error) {
        await Investment.updateOne(
          { _id: due._id, status: 'Matured', paidOutAt: null, payoutProcessingToken: processingToken },
          { $unset: { payoutProcessingAt: '', payoutProcessingToken: '' } }
        );
        throw error;
      }
    }
  } finally {
    payoutSettlementInProgress = false;
  }
};

const calculateInvestorReturns = (investments, returnsAdjustment = 0) => (
  investments.reduce((sum, investment) => {
    if (investment.status === 'Active') {
      return sum + investmentValueAt(investment) - Number(investment.investedAmount || 0);
    }
    return sum + Number(investment.realizedReturn || 0);
  }, Number(returnsAdjustment || 0))
);

// Universal DTO mapper handling both Mongoose documents and lean objects safely
const toTransactionDto = (transaction) => {
  if (!transaction) return null;
  const obj = typeof transaction.toObject === 'function' ? transaction.toObject() : { ...transaction };
  delete obj.senderRecipient;
  if (obj.eventType === 'adjustment') {
    if (obj.category === 'Admin Adjustment') obj.category = 'System adjustment';
    if (obj.paymentMethod === 'Admin adjustment') obj.paymentMethod = 'System adjustment';
    obj.description = String(obj.description || '').replace(/^Admin balance/, 'System adjustment: balance');
  }
  const createdAt = obj.createdAt ? new Date(obj.createdAt) : new Date();

  return {
    ...obj,
    id: String(obj._id),
    reference: obj.reference,
    date: createdAt.toISOString().slice(0, 10),
    time: createdAt.toISOString().slice(11, 16),
    requestDate: createdAt.toLocaleString('en-US'),
    referenceId: obj.reference,
    amountUsd: obj.amount || 0,
    feeUsd: obj.fee || 0,
    netAmountUsd: Math.max((obj.amount || 0) - (obj.fee || 0), 0),
    method: obj.paymentMethod || obj.method || '',
  };
};

// --- DASHBOARD CONTROLLER ---

const getDashboard = async (req, res) => {
  try {
    await settleDueInvestments(req.redisClient);
    const [investments, transactions] = await Promise.all([
      Investment.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
      Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const freshUser = await User.findById(req.user._id).select('balance totalInvested returnsAdjustment').lean();
    if (!freshUser) return sendError(res, 404, 'Investor account not found.');
    const balance = Number(freshUser.balance ?? 0);
    if (!Number.isFinite(balance)) throw new Error('User balance is not a valid number.');

    const activeInvestments = investments.filter((item) => item.status === 'Active');
    const totalInvested = activeInvestments.reduce((sum, item) => sum + Number(item.investedAmount || 0), 0);
    const totalReturns = calculateInvestorReturns(investments, Number(freshUser.returnsAdjustment || 0));

    return res.json({
      success: true,
      data: {
        balance,
        totalInvested,
        totalReturns,
        activeInvestments: activeInvestments.length,
        activePlans: [...new Set(activeInvestments.map((item) => item.planSlug))],
        recentTransactions: transactions.map(toTransactionDto),
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load dashboard data.', error.message);
  }
};

// --- INVESTMENT PLAN CONTROLLERS ---

const seedInvestmentPlans = async (req, res) => {
  try {
    // 1. Wipe existing data to prevent duplicate key errors on 'slug'
    await InvestmentPlan.deleteMany({});

    // 2. Insert fresh assets data
    const createdPlans = await InvestmentPlan.insertMany(ASSETS_DATA);

    return res.status(201).json({
      success: true,
      count: createdPlans.length,
      message: 'Database wiped and re-seeded successfully!',
      data: createdPlans,
    });
  } catch (error) {
    console.error('Error re-seeding:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to re-seed investment assets',
      error: error.message,
    });
  }
};


const createPlan = async (req, res) => {
  try {
    const {
      name, slug, symbol, category, price, change24h, yieldType, yieldPercent,
      payoutIntervalDays, payoutDate, minInvestment, riskLevel, badge, description, tags, active,
    } = req.body;

    if (!name || !slug || !symbol || !category || minInvestment === undefined || yieldPercent === undefined || !yieldType || !description) {
      return sendError(res, 400, 'Please provide all required investment plan fields.');
    }

    const minimum = Number(minInvestment);
    const yieldRate = Number(yieldPercent);
    const payoutDays = Number(payoutIntervalDays ?? 30);
    const planPrice = Number(price ?? 0);
    const dailyChange = Number(change24h ?? 0);
    if (!Number.isFinite(minimum) || minimum <= 0 || !Number.isFinite(yieldRate) || yieldRate < 0 ||
        !Number.isFinite(payoutDays) || payoutDays < 1 || !Number.isFinite(planPrice) || planPrice < 0 ||
        !Number.isFinite(dailyChange)) {
      return sendError(res, 400, 'Plan amounts, yield, and payout interval must be valid non-negative values.');
    }
    if (!['weekly', 'monthly'].includes(yieldType)) return sendError(res, 400, 'Yield type must be weekly or monthly.');

    const cleanSlug = String(slug).toLowerCase().trim();
    const existingPlan = await InvestmentPlan.findOne({ slug: cleanSlug }).lean();

    if (existingPlan) {
      return sendError(res, 400, `An investment plan with slug '${cleanSlug}' already exists.`);
    }

    const payoutDateValue = payoutDate ? new Date(payoutDate) : null;
    if (payoutDateValue && Number.isNaN(payoutDateValue.getTime())) {
      return sendError(res, 400, 'The plan payout date is invalid.');
    }

    const newPlan = await InvestmentPlan.create({
      name: String(name).trim(),
      slug: cleanSlug,
      symbol: String(symbol).trim().toUpperCase(),
      category: String(category).toLowerCase().trim(),
      price: planPrice,
      change24h: dailyChange,
      yieldType,
      yieldPercent: yieldRate,
      payoutIntervalDays: payoutDays,
      payoutDate: payoutDateValue,
      minInvestment: minimum,
      expectedReturns: Number((minimum * (1 + yieldRate / 100)).toFixed(2)),
      riskLevel,
      badge: badge || null,
      description: String(description).trim(),
      tags: Array.isArray(tags) ? tags : [],
      active: active !== undefined ? Boolean(active) : true,
    });

    return res.status(201).json({ success: true, message: 'Investment plan created successfully', data: newPlan });
  } catch (error) {
    if (error.name === 'ValidationError') return sendError(res, 400, error.message);
    return sendError(res, 500, 'Failed to create investment plan.', error.message);
  }
};

const listPlans = async (req, res) => {
  try {
    const filter = req.user?.role === 'admin' ? {} : { active: true };
    const plans = await InvestmentPlan.find(filter).sort({ createdAt: 1 }).lean();
    return res.json({ success: true, data: plans });
  } catch (error) {
    return sendError(res, 500, 'Could not load investment plans.', error.message);
  }
};

const updatePlan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid plan ID format.');

  try {
    const plan = await InvestmentPlan.findById(req.params.id);
    if (!plan) return sendError(res, 404, 'Investment plan not found.');

    const allowedFields = [
      'name', 'slug', 'symbol', 'category', 'price', 'change24h', 'yieldType',
      'yieldPercent', 'payoutIntervalDays', 'payoutDate', 'minInvestment',
      'riskLevel', 'badge', 'description', 'tags', 'active',
    ];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    for (const field of ['price', 'yieldPercent', 'payoutIntervalDays', 'minInvestment', 'change24h']) {
      if (update[field] === undefined) continue;
      const value = Number(update[field]);
      if (!Number.isFinite(value) || (field !== 'change24h' && value < 0) || (field === 'payoutIntervalDays' && value < 1) || (field === 'minInvestment' && value <= 0)) {
        return sendError(res, 400, `${field} must be a valid ${field === 'payoutIntervalDays' ? 'positive' : 'non-negative'} number.`);
      }
      update[field] = value;
    }
    if (update.payoutDate !== undefined) {
      if (update.payoutDate === null || update.payoutDate === '') update.payoutDate = null;
      else {
        const payoutDateValue = new Date(update.payoutDate);
        if (Number.isNaN(payoutDateValue.getTime())) return sendError(res, 400, 'The plan payout date is invalid.');
        update.payoutDate = payoutDateValue;
      }
    }
    if (update.tags !== undefined && !Array.isArray(update.tags)) return sendError(res, 400, 'Plan tags must be an array.');

    const nextMinimum = update.minInvestment ?? plan.minInvestment;
    const nextYieldPercent = update.yieldPercent ?? plan.yieldPercent;
    if (req.body.expectedReturns !== undefined && update.yieldPercent === undefined && update.minInvestment === undefined) {
      const expectedPayout = Number(req.body.expectedReturns);
      if (!Number.isFinite(expectedPayout) || expectedPayout < nextMinimum) {
        return sendError(res, 400, 'Expected payout must be at least the plan minimum investment.');
      }
      update.yieldPercent = ((expectedPayout / nextMinimum) - 1) * 100;
    }
    const finalYieldPercent = update.yieldPercent ?? nextYieldPercent;
    const finalMinimum = update.minInvestment ?? nextMinimum;
    update.expectedReturns = Number((finalMinimum * (1 + finalYieldPercent / 100)).toFixed(2));

    Object.assign(plan, update);
    await plan.save();
    return res.json({ success: true, data: plan });
  } catch (error) {
    if (error.code === 11000) return sendError(res, 400, 'Plan slug or symbol must be unique.');
    return sendError(res, 400, error.message);
  }
};

const deletePlan = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid plan ID format.');

  try {
    const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, { active: false }, { returnDocument: 'after' });
    if (!plan) return sendError(res, 404, 'Investment plan not found.');
    return res.json({ success: true, data: plan });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// --- INVESTMENT CONTROLLERS ---

const listInvestments = async (req, res) => {
  try {
    await settleDueInvestments(req.redisClient);
    const investments = await Investment.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const formatted = investments.map((investment) => {
      const payoutTarget = Number(investment.payoutAmount ?? investment.investedAmount ?? 0);
      const currentValue = investment.status === 'Matured' ? payoutTarget : investmentValueAt(investment);
      const totalProfit = currentValue - (investment.investedAmount || 0);
      return {
        ...investment,
        id: String(investment._id),
        currentValue,
        assetId: investment.planSlug,
        totalProfit,
        profitPercentage: investment.investedAmount ? (totalProfit / investment.investedAmount) * 100 : 0,
        nextPayoutDate: investment.payoutDate ? new Date(investment.payoutDate).toISOString().slice(0, 10) : '',
        expectedReturns: payoutTarget,
        payoutAmount: payoutTarget,
      };
    });
    return res.json({ success: true, data: formatted });
  } catch (error) {
    return sendError(res, 500, 'Could not load investments.', error.message);
  }
};

const createInvestment = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Investment amount must be greater than zero.');

  try {
    await settleDueInvestments(req.redisClient);
    const planQuery = { active: true };
    if (req.body.planId && mongoose.isValidObjectId(req.body.planId)) {
      planQuery._id = req.body.planId;
    } else if (req.body.planSlug) {
      planQuery.slug = String(req.body.planSlug).toLowerCase().trim();
    } else {
      return sendError(res, 400, 'Plan ID or Slug is required.');
    }

    const plan = await InvestmentPlan.findOne(planQuery).lean();
    if (!plan) return sendError(res, 404, 'Investment plan not found or is currently inactive.');
    if (amount < plan.minInvestment) return sendError(res, 400, `Minimum investment for this plan is $${plan.minInvestment}.`);

    const now = new Date();
    const configuredPayoutDate = plan.payoutDate ? new Date(plan.payoutDate) : null;
    const payoutDate = configuredPayoutDate && configuredPayoutDate > now
      ? configuredPayoutDate
      : new Date(now.getTime() + Number(plan.payoutIntervalDays || 30) * 24 * 60 * 60 * 1000);
    const minimumInvestment = Number(plan.minInvestment);
    const payoutMultiple = minimumInvestment > 0
      ? Number(plan.expectedReturns || minimumInvestment) / minimumInvestment
      : 1 + Number(plan.yieldPercent || 0) / 100;
    const payoutAmount = Number((amount * payoutMultiple).toFixed(2));
    if (!Number.isFinite(payoutAmount) || payoutAmount < amount) {
      return sendError(res, 400, 'The plan payout configuration is invalid.');
    }

    const deduction = await adjustUserBalance(req.user._id, -amount, 0);
    if (deduction.insufficientBalance) return sendError(res, 400, 'Insufficient available balance.');
    if (deduction.matchedCount !== 1) return sendError(res, 404, 'Investor account not found.');

    let createdInvestment;
    let createdTransaction;
    let totalsUpdated = false;

    try {
      createdInvestment = await Investment.create({
        user: req.user._id,
        plan: plan._id,
        planSlug: plan.slug,
        name: plan.name,
        symbol: plan.symbol,
        category: plan.category,
        investedAmount: amount,
        currentValue: amount,
        yieldType: plan.yieldType,
        yieldPercent: plan.yieldPercent,
        expectedReturns: payoutAmount,
        payoutDate,
        payoutAmount,
        realizedReturn: 0,
      });

      createdTransaction = await Transaction.create({
        user: req.user._id,
        reference: newReference('INV'),
        description: `Investment in ${plan.name}`,
        category: 'Investment',
        amount,
        type: 'Expense',
        status: 'Completed',
        eventType: 'investment',
        planSlug: plan.slug,
        senderRecipient: plan.name,
      });

      const totalsUpdate = await adjustUserNumericField(req.user._id, 'totalInvested', amount);
      if (totalsUpdate.matchedCount !== 1) throw new Error('Investor account was not found.');
      totalsUpdated = true;
      await invalidateCache(req.redisClient, `user:${req.user._id}`);

      return res.status(201).json({ success: true, data: createdInvestment });
    } catch (error) {
      if (createdTransaction) await Transaction.deleteOne({ _id: createdTransaction._id });
      if (createdInvestment) await Investment.deleteOne({ _id: createdInvestment._id });
      if (totalsUpdated) {
        const totalsRollback = await adjustUserNumericField(req.user._id, 'totalInvested', -amount, 0);
        if (totalsRollback.matchedCount !== 1) {
          throw new Error('Investment creation failed and the invested-total rollback also failed.');
        }
      }
      await incrementUserBalance(req.user._id, amount);
      throw error;
    }
  } catch (error) {
    return sendError(res, 500, 'Could not create investment.', error.message);
  }
};

const getPortfolio = async (req, res) => {
  try {
    await settleDueInvestments(req.redisClient);
    const investments = await Investment.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const freshUser = await User.findById(req.user._id).select('balance totalInvested returnsAdjustment').lean();
    if (!freshUser) return sendError(res, 404, 'Investor account not found.');
    const userBalance = Number(freshUser.balance ?? 0);
    if (!Number.isFinite(userBalance)) throw new Error('User balance is not a valid number.');

    const activeInvestments = investments.filter((item) => item.status === 'Active');
    const currentInvestments = activeInvestments.map((item) => withCurrentInvestmentValue(item));
    const totalInvestmentValue = currentInvestments.reduce((sum, item) => sum + item.currentValue, 0);
    const totalPortfolioValue = totalInvestmentValue + userBalance;

    const holdings = currentInvestments.map((item) => {
      const gain = (item.currentValue || 0) - (item.investedAmount || 0);
      return {
        id: String(item._id),
        name: item.name,
        symbol: item.symbol,
        category: item.category,
        investedAmount: item.investedAmount,
        currentValue: item.currentValue,
        unitsHeld: item.investedAmount,
        avgBuyPrice: 1,
        currentPrice: item.investedAmount ? item.currentValue / item.investedAmount : 0,
        totalValue: item.currentValue,
        payoutAmount: item.payoutAmount,
        payoutDate: item.payoutDate,
        yieldType: item.yieldType,
        yieldPercent: item.yieldPercent,
        status: item.status,
        unrealizedProfit: gain,
        profitPercentage: item.investedAmount ? (gain / item.investedAmount) * 100 : 0,
        change24h: 0,
        allocationPercentage: totalPortfolioValue ? (item.currentValue / totalPortfolioValue) * 100 : 0,
      };
    });

    if (userBalance > 0) {
      holdings.push({
        id: 'cash-balance',
        name: 'Available Cash Balance',
        symbol: 'USD',
        category: 'cash',
        investedAmount: userBalance,
        currentValue: userBalance,
        unitsHeld: userBalance,
        avgBuyPrice: 1,
        currentPrice: 1,
        totalValue: userBalance,
        status: 'Available',
        unrealizedProfit: 0,
        profitPercentage: 0,
        change24h: 0,
        allocationPercentage: totalPortfolioValue ? (userBalance / totalPortfolioValue) * 100 : 0,
      });
    }

    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean();

    return res.json({
      success: true,
      data: {
        holdings,
        activities: transactions.map(toTransactionDto),
        totalValue: totalPortfolioValue,
        totalInvested: Number(freshUser.totalInvested || 0),
        totalReturns: calculateInvestorReturns(investments, Number(freshUser.returnsAdjustment || 0)),
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load portfolio.', error.message);
  }
};

// --- TRANSACTION CONTROLLERS ---

const listTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const formatted = transactions.map(toTransactionDto);

    const metrics = {
      totalVolume: formatted.reduce((sum, item) => sum + item.amount, 0),
      totalIncome: formatted.filter((item) => item.type === 'Income' && item.status === 'Completed').reduce((sum, item) => sum + item.amount, 0),
      totalExpenses: formatted.filter((item) => item.type === 'Expense' && item.status === 'Completed').reduce((sum, item) => sum + item.amount, 0),
      pendingCount: formatted.filter((item) => item.status === 'Pending').length,
    };

    return res.json({ success: true, data: { transactions: formatted, metrics } });
  } catch (error) {
    return sendError(res, 500, 'Could not load transactions.', error.message);
  }
};

// --- DEPOSIT METHOD CONTROLLERS ---

const depositMethodsSeed = [
  {
    asset: "BTC",
    name: "Bitcoin",
    network: "Bitcoin (BTC)",
    address: "1Ln6SX3CifXmvqPD8ytcx1PVcPTpU6WmGi",
    minimumUsdAmount: 50,
    confirmations: 1,
    active: true
  },
  {
    asset: "USDT",
    name: "Tether USD",
    network: "BEP20 (Binance Smart Chain)",
    address: "0x29df72b53484a2ff47395a56a9273c92907589c5",
    minimumUsdAmount: 10,
    confirmations: 15,
    active: true
  },
  {
    asset: "ETH",
    name: "Ethereum",
    network: "BEP20 (Binance Smart Chain)",
    address: "0x29df72b53484a2ff47395a56a9273c92907589c5",
    minimumUsdAmount: 10,
    confirmations: 15,
    active: true
  }
];

const seedDepositMethods = async (_req, res) => {
  try {
    // { ordered: false } ensures that if one item fails due to a duplicate key error,
    // Mongoose will still insert the remaining valid items.
    const insertedMethods = await DepositMethod.insertMany(depositMethodsSeed, { ordered: false });

    return res.status(201).json({
      success: true,
      message: 'Deposit methods inserted successfully.',
      insertedCount: insertedMethods.length,
      data: insertedMethods,
    });
  } catch (error) {
    // Handle duplicate key errors (code 11000) or partial batch write failures
    if (error.name === 'MongoBulkWriteError' || error.code === 11000) {
      const insertedCount = error.insertedDocs ? error.insertedDocs.length : 0;
      
      return res.status(207).json({
        success: true,
        message: 'Some deposit methods were skipped because they already exist in the database.',
        insertedCount,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to insert deposit methods.',
      error: error.message,
    });
  }
};

const listDepositMethods = async (req, res) => {
  try {
    const filter = req.user?.role === 'admin' ? {} : { active: true };
    const methods = await DepositMethod.find(filter).sort({ asset: 1 }).lean();
    return res.json({ success: true, data: methods });
  } catch (error) {
    return sendError(res, 500, 'Could not load deposit methods.', error.message);
  }
};

const createDepositMethod = async (req, res) => {
  try {
    const method = await DepositMethod.create(req.body);
    return res.status(201).json({ success: true, data: method });
  } catch (error) {
    if (error.code === 11000) return sendError(res, 400, 'This asset and network combination already exists.');
    return sendError(res, 400, error.message);
  }
};

const updateDepositMethod = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid deposit method ID.');

  try {
    const method = await DepositMethod.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!method) return sendError(res, 404, 'Deposit method not found.');
    return res.json({ success: true, data: method });
  } catch (error) {
    if (error.code === 11000) return sendError(res, 400, 'This asset and network combination already exists.');
    return sendError(res, 400, error.message);
  }
};

// --- DEPOSIT CONTROLLERS ---

const listDeposits = async (req, res) => {
  try {
    const deposits = await Transaction.find({ user: req.user._id, eventType: 'deposit' }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: deposits.map(toTransactionDto) });
  } catch (error) {
    return sendError(res, 500, 'Could not load deposits.', error.message);
  }
};

const createDeposit = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Deposit amount must be greater than zero.');

  const txHash = String(req.body.txHash || '').trim();
  if (!txHash) return sendError(res, 400, 'Blockchain transaction hash (txHash) is required.');

  try {
    const asset = String(req.body.asset || '').toUpperCase().trim();
    if (!asset) return sendError(res, 400, 'Deposit asset is required.');

    // Check if txHash has already been submitted to prevent duplicate deposits
    const existingTx = await Transaction.findOne({ externalReference: txHash }).lean();
    if (existingTx) return sendError(res, 400, 'This transaction hash has already been submitted.');

    const method = await DepositMethod.findOne({ asset, active: true }).lean();
    if (!method) return sendError(res, 400, 'No active deposit method is configured for this asset.');
    if (amount < method.minimumUsdAmount) return sendError(res, 400, `Minimum deposit for ${asset} is $${method.minimumUsdAmount}.`);

    const deposit = await Transaction.create({
      user: req.user._id,
      reference: newReference('DEP'),
      description: `${asset} deposit request`,
      category: 'Deposit',
      amount,
      type: 'Income',
      status: 'Pending',
      eventType: 'deposit',
      paymentMethod: `${asset} (${method.network})`,
      senderRecipient: asset,
      asset,
      externalReference: txHash,
    });

    return res.status(201).json({ success: true, data: toTransactionDto(deposit) });
  } catch (error) {
    return sendError(res, 500, 'Could not submit deposit request.', error.message);
  }
};

// --- WITHDRAWAL CONTROLLERS ---

const listWithdrawals = async (req, res) => {
  try {
    await settleDueInvestments(req.redisClient);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [withdrawals, usage] = await Promise.all([
      Transaction.find({ user: req.user._id, eventType: 'withdrawal' }).sort({ createdAt: -1 }).lean(),
      Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(String(req.user._id)),
            eventType: 'withdrawal',
            status: { $in: ['Pending', 'Completed'] },
            createdAt: { $gte: since },
          },
        },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        withdrawals: withdrawals.map(toTransactionDto),
        dailyLimitUsed: usage[0]?.amount || 0,
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load withdrawals.', error.message);
  }
};

const createWithdrawal = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Withdrawal amount must be greater than zero.');

  const method = String(req.body.method || '').trim();
  const destination = String(req.body.destination || '').trim();
  if (!method || !destination) return sendError(res, 400, 'Payout method and destination address/account are required.');

  const network = String(req.body.network || '').toUpperCase();
  const feeMap = { TRC20: 1.5, ERC20: 12, BITCOIN: 8, BEP20: 2 };
  const fee = method === 'bank' ? 25 : method === 'card' ? amount * 0.015 : feeMap[network] || 2;

  if (fee >= amount) return sendError(res, 400, 'Withdrawal amount must be greater than the processing fee.');

  try {
    await settleDueInvestments(req.redisClient);
    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usedToday = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(String(req.user._id)),
          eventType: 'withdrawal',
          createdAt: { $gte: dayStart },
          status: { $in: ['Pending', 'Completed'] },
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);

    const dailyLimit = req.user.withdrawalLimit || 10000;
    if ((usedToday[0]?.amount || 0) + amount > dailyLimit) {
      return sendError(res, 400, 'This request exceeds your rolling 24-hour withdrawal limit.');
    }

    const deduction = await adjustUserBalance(req.user._id, -amount, 0);
    if (deduction.insufficientBalance) return sendError(res, 400, 'Insufficient available balance.');
    if (deduction.matchedCount !== 1) return sendError(res, 404, 'Investor account not found.');

    try {
      const withdrawal = await Transaction.create({
        user: req.user._id,
        reference: newReference('WDR'),
        description: `Withdrawal via ${method}`,
        category: 'Withdrawal',
        amount,
        fee,
        type: 'Transfer',
        status: 'Pending',
        eventType: 'withdrawal',
        paymentMethod: method,
        destination,
        senderRecipient: destination,
      });

      await invalidateCache(req.redisClient, `user:${req.user._id}`);
      return res.status(201).json({ success: true, data: toTransactionDto(withdrawal) });
    } catch (error) {
      // Revert user balance on creation failure
      await incrementUserBalance(req.user._id, amount);
      throw error;
    }
  } catch (error) {
    return sendError(res, 500, 'Could not submit withdrawal request.', error.message);
  }
};

// --- ADMIN CONTROLLERS ---

const reviewTransaction = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid transaction ID format.');

  const nextStatus = req.body.status;
  if (!['Completed', 'Failed'].includes(nextStatus)) return sendError(res, 400, 'Status must be set to Completed or Failed.');

  try {
    // Atomic status transition from 'Pending'
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, eventType: { $in: ['deposit', 'withdrawal'] }, status: 'Pending' },
      { $set: { status: nextStatus } },
      { returnDocument: 'after' }
    );

    if (!transaction) return sendError(res, 404, 'Pending request not found or already processed.');

    if (transaction.eventType === 'deposit' && nextStatus === 'Completed') {
      try {
        const result = await incrementUserBalance(transaction.user, transaction.amount);
        if (result.matchedCount !== 1) throw new Error('Investor account was not found.');
      } catch (error) {
        const rollback = await Transaction.updateOne(
          { _id: transaction._id, status: nextStatus },
          { $set: { status: 'Pending' } }
        );
        if (rollback.matchedCount !== 1) {
          throw new Error('Balance credit failed and the transaction could not be returned to Pending.');
        }
        throw error;
      }
    }

    if (transaction.eventType === 'withdrawal' && nextStatus === 'Failed') {
      try {
        const result = await incrementUserBalance(transaction.user, transaction.amount);
        if (result.matchedCount !== 1) throw new Error('Investor account was not found.');
      } catch (error) {
        const rollback = await Transaction.updateOne(
          { _id: transaction._id, status: nextStatus },
          { $set: { status: 'Pending' } }
        );
        if (rollback.matchedCount !== 1) {
          throw new Error('Balance refund failed and the transaction could not be returned to Pending.');
        }
        throw error;
      }
    }

    await invalidateCache(req.redisClient, `user:${transaction.user}`);
    return res.json({ success: true, data: toTransactionDto(transaction) });
  } catch (error) {
    console.error('Could not review transaction request:', error);
    return sendError(res, 500, 'Could not review transaction request.', error.message);
  }
};

const getAdminOverview = async (_req, res) => {
  try {
    const [userCount, depositStats, withdrawalStats, activeInvestments, recentUsers, pendingRequests] = await Promise.all([
      User.countDocuments(),
      Transaction.aggregate([{ $match: { eventType: 'deposit', status: 'Completed' } }, {$group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { eventType: 'withdrawal', status: 'Completed' } }, {$group: { _id: null, total: { $sum: '$amount' } } }]),
      Investment.countDocuments({ status: 'Active' }),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email role createdAt').lean(),
      Transaction.find({ eventType: { $in: ['deposit', 'withdrawal'] }, status: 'Pending' })
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        metrics: {
          totalUsers: userCount,
          totalDeposits: depositStats[0]?.total || 0,
          totalWithdrawals: withdrawalStats[0]?.total || 0,
          activeInvestments,
        },
        recentUsers: recentUsers.map((u) => ({
          id: String(u._id),
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User',
          email: u.email,
          plan: 'No active plan',
          status: 'Active',
        })),
        pendingRequests: pendingRequests.map((item) => ({
          ...toTransactionDto(item),
          user: item.user ? `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim() : 'Unknown user',
        })),
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load admin overview.', error.message);
  }
};

const listAllUsers = async (_req, res) => {
  try {
    const [users, investments] = await Promise.all([
      User.find({ role: 'investor' })
        .select('firstName lastName email phone dob country streetAddress city state postalCode investorType targetCapital balance totalInvested totalReturns returnsAdjustment role kycStatus avatar createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Investment.find().lean(),
    ]);
    const investmentsByUser = new Map();
    investments.forEach((investment) => {
      const userId = String(investment.user);
      const investorInvestments = investmentsByUser.get(userId) || [];
      investorInvestments.push(investment);
      investmentsByUser.set(userId, investorInvestments);
    });
    return res.json({ success: true, data: users.map((investor) => ({
      ...investor,
      totalReturns: calculateInvestorReturns(
        investmentsByUser.get(String(investor._id)) || [],
        Number(investor.returnsAdjustment || 0)
      ),
    })) });
  } catch (error) {
    return sendError(res, 500, 'Could not load users.', error.message);
  }
};

const listAdminTransactions = async (req, res) => {
  const allowedEventTypes = ['deposit', 'withdrawal', 'investment', 'adjustment'];
  const eventType = req.query.eventType ? String(req.query.eventType) : '';
  if (eventType && !allowedEventTypes.includes(eventType)) {
    return sendError(res, 400, 'Invalid transaction event type.');
  }

  try {
    const filter = eventType ? { eventType } : {};
    const transactions = await Transaction.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      success: true,
      data: transactions.map((transaction) => ({
        ...toTransactionDto(transaction),
        user: transaction.user ? {
          id: String(transaction.user._id),
          name: `${transaction.user.firstName || ''} ${transaction.user.lastName || ''}`.trim(),
          email: transaction.user.email,
        } : null,
      })),
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load platform transactions.', error.message);
  }
};

const listAdminInvestments = async (_req, res) => {
  try {
    const investments = await Investment.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      success: true,
      data: investments.map((investment) => ({
        ...withCurrentInvestmentValue(investment),
        id: String(investment._id),
        user: investment.user ? {
          id: String(investment.user._id),
          name: `${investment.user.firstName || ''} ${investment.user.lastName || ''}`.trim(),
          email: investment.user.email,
        } : null,
      })),
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load investor investments.', error.message);
  }
};

const updateAdminInvestmentStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid investment ID format.');

  const { status, payoutDate, expectedReturns, payoutAmount } = req.body;
  const allowedStatuses = ['Active', 'Matured', 'Locked'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return sendError(res, 400, 'Investment status must be Active, Matured, or Locked.');
  }

  try {
    const existingInvestment = await Investment.findById(req.params.id).lean();
    if (!existingInvestment) return sendError(res, 404, 'Investment not found.');
    if (existingInvestment.status === 'Matured') {
      if (existingInvestment.paidOutAt && status === 'Matured' && payoutDate === undefined && expectedReturns === undefined && payoutAmount === undefined) {
        return res.json({ success: true, data: existingInvestment });
      }
      return sendError(res, 400, 'Matured investments cannot be reopened or have their payout terms changed.');
    }
    if (payoutDate !== undefined && existingInvestment.status !== 'Active') {
      return sendError(res, 400, 'Only active investments can have their payout date changed.');
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (payoutDate !== undefined && payoutDate !== null && payoutDate !== '') {
      const parsedDate = new Date(payoutDate);
      if (Number.isNaN(parsedDate.getTime())) return sendError(res, 400, 'The payout date is invalid.');
      updates.payoutDate = parsedDate;
    }
    if (expectedReturns !== undefined || payoutAmount !== undefined) {
      const nextPayout = Number(payoutAmount ?? expectedReturns);
      if (!Number.isFinite(nextPayout) || nextPayout < Number(existingInvestment.investedAmount || 0)) {
        return sendError(res, 400, 'Payout amount must be a valid amount no less than the invested capital.');
      }
      updates.expectedReturns = nextPayout;
      updates.payoutAmount = nextPayout;
      updates.realizedReturn = nextPayout - Number(existingInvestment.investedAmount || 0);
    }

    if (status === 'Matured') {
      updates.status = 'Active';
      updates.payoutDate = new Date();
    }

    const investment = await Investment.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    if (!investment) return sendError(res, 404, 'Investment not found.');
    if (status === 'Matured') {
      await settleDueInvestments(req.redisClient);
      const settledInvestment = await Investment.findById(req.params.id).lean();
      if (!settledInvestment?.paidOutAt) {
        return sendError(res, 500, 'Investment payout could not be completed.');
      }
      await invalidateCache(req.redisClient, `user:${settledInvestment.user}`);
      return res.json({ success: true, data: settledInvestment });
    }
    await invalidateCache(req.redisClient, `user:${investment.user}`);
    return res.json({ success: true, data: investment });
  } catch (error) {
    return sendError(res, 500, 'Could not update investment status.', error.message);
  }
};

const adjustInvestorBalance = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid user ID format.');

  const amount = Number(req.body.amount);
  const direction = req.body.direction;
  const reason = String(req.body.reason || '').trim();
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Adjustment amount must be greater than zero.');
  if (!['credit', 'debit'].includes(direction)) return sendError(res, 400, 'Adjustment direction must be credit or debit.');
  if (!reason) return sendError(res, 400, 'A reason is required for balance adjustments.');

  try {
    const investor = await User.findOne({ _id: req.params.id, role: 'investor' }).select('_id').lean();
    if (!investor) return sendError(res, 404, 'Investor not found.');

    const delta = direction === 'credit' ? amount : -amount;
    const balanceUpdate = await adjustUserBalance(investor._id, delta, 0);
    if (balanceUpdate.insufficientBalance) return sendError(res, 400, 'Debit exceeds the investor available balance.');
    if (balanceUpdate.matchedCount !== 1) return sendError(res, 404, 'Investor not found.');

    let transaction;
    try {
      transaction = await Transaction.create({
        user: investor._id,
        reference: newReference('ADJ'),
        description: `System adjustment: balance ${direction} - ${reason}`,
        category: 'System adjustment',
        amount,
        type: direction === 'credit' ? 'Income' : 'Expense',
        status: 'Completed',
        eventType: 'adjustment',
        paymentMethod: 'System adjustment',
      });
    } catch (error) {
      const rollback = await adjustUserBalance(investor._id, -delta);
      if (rollback.matchedCount !== 1) {
        throw new Error('Adjustment record failed and the balance rollback could not be completed.');
      }
      throw error;
    }

    await invalidateCache(req.redisClient, `user:${investor._id}`);
    const updatedInvestor = await User.findById(investor._id)
      .select('firstName lastName email phone country investorType targetCapital balance totalInvested totalReturns role kycStatus createdAt')
      .lean();
    return res.status(201).json({
      success: true,
      data: { user: updatedInvestor, transaction: toTransactionDto(transaction) },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not adjust investor balance.', error.message);
  }
};

const getAdminUserDetail = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid user ID.');

  try {
    const [user, transactions, investments] = await Promise.all([
      User.findById(req.params.id)
        .select('firstName lastName email phone dob country streetAddress city state postalCode investorType targetCapital balance totalInvested totalReturns returnsAdjustment role kycStatus avatar createdAt')
        .lean(),
      Transaction.find({ user: req.params.id }).sort({ createdAt: -1 }).lean(),
      Investment.find({ user: req.params.id }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) return sendError(res, 404, 'User not found.');
    user.totalReturns = calculateInvestorReturns(investments, Number(user.returnsAdjustment || 0));

    return res.json({
      success: true,
      data: {
        user,
        transactions: transactions.map(toTransactionDto),
        investments: investments.map((investment) => ({ ...investment, id: String(investment._id) })),
      },
    });
  } catch (error) {
    return sendError(res, 500, 'Could not load user account activity.', error.message);
  }
};

const updateInvestor = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid user ID format.');

  const stringFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'streetAddress', 'city', 'state', 'postalCode', 'investorType', 'targetCapital'];
  const numericFields = ['totalInvested', 'totalReturns'];
  const updates = {};

  for (const field of stringFields) {
    if (req.body[field] !== undefined) {
      updates[field] = String(req.body[field]).trim();
      if (field === 'email') updates[field] = updates[field].toLowerCase();
    }
  }
  for (const field of numericFields) {
    if (req.body[field] === undefined) continue;
    const value = Number(req.body[field]);
    if (!Number.isFinite(value) || value < 0) return sendError(res, 400, `${field} must be a non-negative number.`);
    updates[field] = value;
  }
  if (req.body.dob !== undefined) {
    const dob = new Date(req.body.dob);
    if (Number.isNaN(dob.getTime())) return sendError(res, 400, 'Date of birth is invalid.');
    updates.dob = dob;
  }
  if (req.body.kycStatus !== undefined) {
    if (!['unverified', 'pending', 'verified', 'rejected'].includes(req.body.kycStatus)) return sendError(res, 400, 'KYC status is invalid.');
    updates.kycStatus = req.body.kycStatus;
  }

  try {
    const investor = await User.findOne({ _id: req.params.id, role: 'investor' });
    if (!investor) return sendError(res, 404, 'Investor not found.');

    if (updates.totalReturns !== undefined) {
      const activeInvestments = await Investment.find({ user: investor._id }).lean();
      const earnedReturns = calculateInvestorReturns(activeInvestments, 0);
      investor.returnsAdjustment = updates.totalReturns - earnedReturns;
      delete updates.totalReturns;
    }
    Object.assign(investor, updates);
    await investor.save();
    await invalidateCache(req.redisClient, `user:${investor._id}`);

    const responseUser = investor.toObject();
    delete responseUser.password;
    const investments = await Investment.find({ user: investor._id }).lean();
    responseUser.totalReturns = calculateInvestorReturns(investments, Number(investor.returnsAdjustment || 0));
    return res.json({ success: true, data: responseUser });
  } catch (error) {
    return sendError(res, 400, 'Could not update investor.', error.message);
  }
};

// --- USER SETTINGS CONTROLLER ---

const updateSettings = async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'phone', 'dob', 'country', 'streetAddress', 'city', 'state', 'postalCode', 'jobTitle', 'company', 'bio', 'timezone'];

  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 404, 'User not found.');

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }

    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const allowedPrefKeys = ['emailAlerts', 'securityAlerts', 'weeklyReport', 'marketingEmails', 'twoFactorEnabled'];
      user.preferences = user.preferences || {};
      for (const key of allowedPrefKeys) {
        if (typeof req.body.preferences[key] === 'boolean') {
          user.preferences[key] = req.body.preferences[key];
        }
      }
    }

    await user.save();
    await invalidateCache(req.redisClient, `user:${user._id}`);

    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ success: true, data: userObj });
  } catch (error) {
    return sendError(res, 400, 'Could not save account settings.', error.message);
  }
};

const uploadAvatar = async (req, res) => {
  if (!req.file) return sendError(res, 400, 'Choose an image to upload.');

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'vicbits/avatars', public_id: String(req.user._id), overwrite: true, resource_type: 'image' },
        (error, uploaded) => error ? reject(error) : resolve(uploaded)
      );
      stream.end(req.file.buffer);
    });
    req.user.avatar = result.secure_url;
    await req.user.save();
    await invalidateCache(req.redisClient, `user:${req.user._id}`);
    return res.json({ success: true, data: { avatar: req.user.avatar } });
  } catch (error) {
    return sendError(res, 500, 'Could not upload profile image. Check the image and Cloudinary configuration.', error.message);
  }
};

module.exports = {
  getDashboard,
  settleDueInvestments,
  listPlans,
  seedInvestmentPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listInvestments,
  createInvestment,
  getPortfolio,
  listTransactions,
  seedDepositMethods,
  listDepositMethods,
  createDepositMethod,
  updateDepositMethod,
  listDeposits,
  createDeposit,
  listWithdrawals,
  createWithdrawal,
  reviewTransaction,
  getAdminOverview,
  listAllUsers,
  listAdminTransactions,
  listAdminInvestments,
  updateAdminInvestmentStatus,
  adjustInvestorBalance,
  getAdminUserDetail,
  updateInvestor,
  updateSettings,
  uploadAvatar,
};