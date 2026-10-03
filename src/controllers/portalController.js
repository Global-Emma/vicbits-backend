const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const InvestmentPlan = require('../models/InvestmentPlan');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const DepositMethod = require('../models/DepositMethod');
const { invalidateCache } = require('../utils/validation');

const ASSETS_DATA = [
  {
    name: "Bitcoin Vault",
    slug: "btc",
    symbol: "BTC",
    category: "crypto",
    price: 94500,
    change24h: 3.85,
    expectedApy: 14.2,
    minInvestment: 50,
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
    expectedApy: 11.5,
    minInvestment: 500,
    riskLevel: "Low",
    badge: "High Yield",
    description: "Fractional ownership in prime Dubai commercial real estate with quarterly dividend payouts.",
    tags: ["Fractional Property", "Quarterly Dividends"],
    active: true,
  },
  {
    name: "Swiss Vault Physical Gold",
    slug: "gold-vault",
    symbol: "XAU-GLD",
    category: "gold",
    price: 2680,
    change24h: 1.15,
    expectedApy: 8.4,
    minInvestment: 100,
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
    expectedApy: 12.8,
    minInvestment: 100,
    riskLevel: "Low",
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
    expectedApy: 18.2,
    minInvestment: 100,
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
    expectedApy: 28.5,
    minInvestment: 3800,
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
    expectedApy: 22.1,
    minInvestment: 100,
    riskLevel: "High",
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
    expectedApy: 13.0,
    minInvestment: 1000,
    riskLevel: "Medium",
    description: "Equity stake in a 42-story office and retail complex in downtown Manhattan, New York.",
    tags: ["Commercial", "US Property"],
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

// Universal DTO mapper handling both Mongoose documents and lean objects safely
const toTransactionDto = (transaction) => {
  if (!transaction) return null;
  const obj = typeof transaction.toObject === 'function' ? transaction.toObject() : { ...transaction };
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
    const [investments, transactions] = await Promise.all([
      Investment.find({ user: req.user._id, status: 'Active' }).sort({ createdAt: -1 }).lean(),
      Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const balance = Number(req.user.balance ?? 0);
    if (!Number.isFinite(balance)) throw new Error('User balance is not a valid number.');

    const totalInvested = investments.reduce((sum, item) => sum + (item.investedAmount || 0), 0);
    const totalReturns = investments.reduce((sum, item) => sum + ((item.currentValue || 0) - (item.investedAmount || 0)), 0);

    return res.json({
      success: true,
      data: {
        balance,
        totalInvested,
        totalReturns,
        activeInvestments: investments.length,
        activePlans: [...new Set(investments.map((item) => item.planSlug))],
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
    const { name, slug, symbol, category, price, change24h, expectedApy, minInvestment, riskLevel, badge, description, tags, active } = req.body;

    if (!name || !slug || !symbol || !category || minInvestment === undefined || !description) {
      return sendError(res, 400, 'Please provide all required investment plan fields.');
    }

    const cleanSlug = String(slug).toLowerCase().trim();
    const existingPlan = await InvestmentPlan.findOne({ slug: cleanSlug }).lean();

    if (existingPlan) {
      return sendError(res, 400, `An investment plan with slug '${cleanSlug}' already exists.`);
    }

    const newPlan = await InvestmentPlan.create({
      name: String(name).trim(),
      slug: cleanSlug,
      symbol: String(symbol).trim().toUpperCase(),
      category: String(category).toLowerCase().trim(),
      price: Number(price) || 0,
      change24h: Number(change24h) || 0,
      expectedApy: Number(expectedApy) || 0,
      minInvestment: Number(minInvestment),
      riskLevel,
      badge,
      description,
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
    const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!plan) return sendError(res, 404, 'Investment plan not found.');
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
    const investments = await Investment.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const formatted = investments.map((investment) => {
      const totalProfit = (investment.currentValue || 0) - (investment.investedAmount || 0);
      return {
        ...investment,
        id: String(investment._id),
        assetId: investment.planSlug,
        totalProfit,
        profitPercentage: investment.investedAmount ? (totalProfit / investment.investedAmount) * 100 : 0,
        nextPayoutDate: '',
        payoutAmount: '',
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

    const deduction = await adjustUserBalance(req.user._id, -amount, 0);
    if (deduction.insufficientBalance) return sendError(res, 400, 'Insufficient available balance.');
    if (deduction.matchedCount !== 1) return sendError(res, 404, 'Investor account not found.');

    let createdInvestment;
    let createdTransaction;

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
        expectedApy: plan.expectedApy,
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
      await invalidateCache(req.redisClient, `user:${req.user._id}`);

      return res.status(201).json({ success: true, data: createdInvestment });
    } catch (error) {
      // Clean rollback if investment creation fails
      if (createdTransaction) await Transaction.deleteOne({ _id: createdTransaction._id });
      if (createdInvestment) await Investment.deleteOne({ _id: createdInvestment._id });
      await incrementUserBalance(req.user._id, amount);
      throw error;
    }
  } catch (error) {
    return sendError(res, 500, 'Could not create investment.', error.message);
  }
};

const getPortfolio = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id, status: 'Active' }).sort({ createdAt: -1 }).lean();
    const userBalance = Number(req.user.balance ?? 0);
    if (!Number.isFinite(userBalance)) throw new Error('User balance is not a valid number.');

    const totalInvestmentValue = investments.reduce((sum, item) => sum + (item.currentValue || 0), 0);
    const totalPortfolioValue = totalInvestmentValue + userBalance;

    const holdings = investments.map((item) => {
      const gain = (item.currentValue || 0) - (item.investedAmount || 0);
      return {
        id: String(item._id),
        name: item.name,
        symbol: item.symbol,
        category: item.category,
        unitsHeld: item.investedAmount,
        avgBuyPrice: 1,
        currentPrice: item.investedAmount ? item.currentValue / item.investedAmount : 0,
        totalValue: item.currentValue,
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
        unitsHeld: userBalance,
        avgBuyPrice: 1,
        currentPrice: 1,
        totalValue: userBalance,
        unrealizedProfit: 0,
        profitPercentage: 0,
        change24h: 0,
        allocationPercentage: totalPortfolioValue ? (userBalance / totalPortfolioValue) * 100 : 0,
      });
    }

    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5).lean();

    return res.json({
      success: true,
      data: { holdings, activities: transactions.map(toTransactionDto), totalValue: totalPortfolioValue },
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
    const users = await User.find({ role: 'investor' })
      .select('firstName lastName email phone country investorType targetCapital balance totalInvested totalReturns role kycStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: users });
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
        ...investment,
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

  const { status } = req.body;
  if (!['Active', 'Matured', 'Locked'].includes(status)) {
    return sendError(res, 400, 'Investment status must be Active, Matured, or Locked.');
  }

  try {
    const investment = await Investment.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    );
    if (!investment) return sendError(res, 404, 'Investment not found.');
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
        description: `Admin balance ${direction}: ${reason}`,
        category: 'Admin Adjustment',
        amount,
        type: direction === 'credit' ? 'Income' : 'Expense',
        status: 'Completed',
        eventType: 'adjustment',
        paymentMethod: 'Admin adjustment',
        senderRecipient: 'Platform administrator',
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
        .select('firstName lastName email phone dob country streetAddress city state postalCode investorType targetCapital balance totalInvested totalReturns role kycStatus createdAt')
        .lean(),
      Transaction.find({ user: req.params.id }).sort({ createdAt: -1 }).lean(),
      Investment.find({ user: req.params.id }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) return sendError(res, 404, 'User not found.');

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

module.exports = {
  getDashboard,
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
  updateSettings,
};