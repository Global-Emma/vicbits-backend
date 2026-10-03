const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const InvestmentPlan = require('../models/InvestmentPlan');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const DepositMethod = require('../models/DepositMethod');
const { invalidateCache } = require('../utils/validation');



const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const newReference = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

const toTransactionDto = (transaction) => {
  const createdAt = transaction.createdAt || new Date();
  return {
    ...transaction.toObject(),
    id: String(transaction._id),
    reference: transaction.reference,
    date: createdAt.toISOString().slice(0, 10),
    time: createdAt.toISOString().slice(11, 16),
    requestDate: createdAt.toLocaleString('en-US'),
    referenceId: transaction.reference,
    amountUsd: transaction.amount,
    feeUsd: transaction.fee,
    netAmountUsd: Math.max(transaction.amount - transaction.fee, 0),
    method: transaction.paymentMethod,
  };
};

const getDashboard = async (req, res) => {
  try {
    const [investments, transactions] = await Promise.all([
      Investment.find({ user: req.user._id, status: 'Active' }).sort({ createdAt: -1 }),
      Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6),
    ]);
    const totalInvested = investments.reduce((sum, item) => sum + item.investedAmount, 0);
    const totalReturns = investments.reduce((sum, item) => sum + item.currentValue - item.investedAmount, 0);

    res.json({
      success: true,
      data: {
        balance: req.user.balance,
        totalInvested,
        totalReturns,
        activeInvestments: investments.length,
        activePlans: [...new Set(investments.map((item) => item.planSlug))],
        recentTransactions: transactions.map(toTransactionDto),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load dashboard data.' });
  }
};




const createPlan = async (req, res) => {
  try {
    const {
      name,
      slug,
      symbol,
      category,
      price,
      change24h,
      expectedApy,
      minInvestment,
      riskLevel,
      badge,
      description,
      tags,
      active,
    } = req.body;

    // Check if plan with slug already exists
    const existingPlan = await InvestmentPlan.findOne({
      slug: slug.toLowerCase().trim(),
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: `An investment plan with slug '${slug}' already exists.`,
      });
    }

    const newPlan = await InvestmentPlan.create({
      name,
      slug,
      symbol,
      category,
      price,
      change24h,
      expectedApy,
      minInvestment,
      riskLevel,
      badge,
      description,
      tags,
      active,
    });

    return res.status(201).json({
      success: true,
      message: 'Investment plan created successfully',
      data: newPlan,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create investment plan',
      error: error.message,
    });
  }
};

const listPlans = async (_req, res) => {
  try {
    const plans = await InvestmentPlan.find({ active: true }).sort({ createdAt: 1 });
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load investment plans.' });
  }
};

const updatePlan = async (req, res) => {
  try {
    const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!plan) return sendError(res, 404, 'Investment plan not found.');
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!plan) return sendError(res, 404, 'Investment plan not found.');
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const listInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: investments.map((investment) => ({
      ...investment.toObject(),
      id: String(investment._id),
      assetId: investment.planSlug,
      totalProfit: investment.currentValue - investment.investedAmount,
      profitPercentage: investment.investedAmount
        ? ((investment.currentValue - investment.investedAmount) / investment.investedAmount) * 100
        : 0,
      nextPayoutDate: '',
      payoutAmount: '',
    })) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load investments.' });
  }
};

const createInvestment = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Investment amount must be greater than zero.');

  try {
    const plan = await InvestmentPlan.findOne({
      active: true,
      ...(req.body.planId ? { _id: req.body.planId } : { slug: req.body.planSlug }),
    });
    if (!plan) return sendError(res, 404, 'Investment plan not found.');
    if (amount < plan.minInvestment) return sendError(res, 400, `Minimum investment is ${plan.minInvestment}.`);

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );
    if (!updatedUser) return sendError(res, 400, 'Insufficient available balance.');

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
      await User.updateOne({ _id: req.user._id }, { $inc: { totalInvested: amount } });
      await invalidateCache(req.redisClient, `user:${req.user._id}`);
      res.status(201).json({ success: true, data: createdInvestment });
    } catch (error) {
      if (createdTransaction) await Transaction.deleteOne({ _id: createdTransaction._id });
      if (createdInvestment) await Investment.deleteOne({ _id: createdInvestment._id });
      await User.updateOne({ _id: req.user._id }, { $inc: { balance: amount } });
      throw error;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not create investment.' });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id, status: 'Active' }).sort({ createdAt: -1 });
    const totalValue = investments.reduce((sum, item) => sum + item.currentValue, 0) + req.user.balance;
    const holdings = investments.map((item) => {
      const gain = item.currentValue - item.investedAmount;
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
        allocationPercentage: totalValue ? (item.currentValue / totalValue) * 100 : 0,
      };
    });
    if (req.user.balance > 0) {
      holdings.push({
        id: 'cash-balance', name: 'Available Cash Balance', symbol: 'USD', category: 'cash',
        unitsHeld: req.user.balance, avgBuyPrice: 1, currentPrice: 1, totalValue: req.user.balance,
        unrealizedProfit: 0, profitPercentage: 0, change24h: 0,
        allocationPercentage: totalValue ? (req.user.balance / totalValue) * 100 : 0,
      });
    }
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
    res.json({ success: true, data: { holdings, activities: transactions.map(toTransactionDto), totalValue } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load portfolio.' });
  }
};

const listTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    const data = transactions.map(toTransactionDto);
    const metrics = {
      totalVolume: data.reduce((sum, item) => sum + item.amount, 0),
      totalIncome: data.filter((item) => item.type === 'Income' && item.status === 'Completed').reduce((sum, item) => sum + item.amount, 0),
      totalExpenses: data.filter((item) => item.type === 'Expense' && item.status === 'Completed').reduce((sum, item) => sum + item.amount, 0),
      pendingCount: data.filter((item) => item.status === 'Pending').length,
    };
    res.json({ success: true, data: { transactions: data, metrics } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load transactions.' });
  }
};

const listDepositMethods = async (_req, res) => {
  try {
    const methods = await DepositMethod.find({ active: true }).sort({ asset: 1 });
    res.json({ success: true, data: methods });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load deposit methods.' });
  }
};

const createDepositMethod = async (req, res) => {
  try {
    const method = await DepositMethod.create(req.body);
    res.status(201).json({ success: true, data: method });
  } catch (error) {
    res.status(400).json({ success: false, message: error.code === 11000 ? 'This asset/network already exists.' : error.message });
  }
};

const listDeposits = async (req, res) => {
  try {
    const deposits = await Transaction.find({ user: req.user._id, eventType: 'deposit' }).sort({ createdAt: -1 });
    res.json({ success: true, data: deposits.map(toTransactionDto) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load deposits.' });
  }
};

const createDeposit = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Deposit amount must be greater than zero.');
  const txHash = String(req.body.txHash || '').trim();
  if (!txHash) return sendError(res, 400, 'Blockchain transaction hash is required.');
  try {
    const asset = String(req.body.asset || '').toUpperCase();
    const method = await DepositMethod.findOne({ asset, active: true });
    if (!method) return sendError(res, 400, 'No active deposit method is configured for this asset.');
    if (amount < method.minimumUsdAmount) return sendError(res, 400, `Minimum deposit is $${method.minimumUsdAmount}.`);
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
    res.status(201).json({ success: true, data: toTransactionDto(deposit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not submit deposit request.' });
  }
};

const listWithdrawals = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [withdrawals, usage] = await Promise.all([
      Transaction.find({ user: req.user._id, eventType: 'withdrawal' }).sort({ createdAt: -1 }),
      Transaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), eventType: 'withdrawal', status: { $in: ['Pending', 'Completed'] }, createdAt: { $gte: since } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
    ]);
    res.json({ success: true, data: { withdrawals: withdrawals.map(toTransactionDto), dailyLimitUsed: usage[0]?.amount || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load withdrawals.' });
  }
};

const createWithdrawal = async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return sendError(res, 400, 'Withdrawal amount must be greater than zero.');
  const method = String(req.body.method || '').trim();
  const destination = String(req.body.destination || '').trim();
  if (!method || !destination) return sendError(res, 400, 'Payout method and destination are required.');

  const network = String(req.body.network || '').toUpperCase();
  const fee = method === 'bank' ? 25 : method === 'card' ? amount * 0.015 : ({ TRC20: 1.5, ERC20: 12, BITCOIN: 8, BEP20: 2 }[network] || 2);
  if (fee >= amount) return sendError(res, 400, 'Withdrawal amount must be greater than the processing fee.');

  try {
    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usedToday = await Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), eventType: 'withdrawal', createdAt: { $gte: dayStart }, status: { $in: ['Pending', 'Completed'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    if ((usedToday[0]?.amount || 0) + amount > req.user.withdrawalLimit) return sendError(res, 400, 'This request exceeds your rolling 24-hour withdrawal limit.');

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );
    if (!updatedUser) return sendError(res, 400, 'Insufficient available balance.');

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
      res.status(201).json({ success: true, data: toTransactionDto(withdrawal) });
    } catch (error) {
      await User.updateOne({ _id: req.user._id }, { $inc: { balance: amount } });
      throw error;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not submit withdrawal request.' });
  }
};

const reviewTransaction = async (req, res) => {
  const nextStatus = req.body.status;
  if (!['Completed', 'Failed'].includes(nextStatus)) return sendError(res, 400, 'Status must be Completed or Failed.');
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, eventType: { $in: ['deposit', 'withdrawal'] }, status: 'Pending' },
      { $set: { status: nextStatus } },
      { new: true }
    );
    if (!transaction) return sendError(res, 404, 'Pending request not found.');
    if (transaction.eventType === 'deposit' && nextStatus === 'Completed') {
      await User.updateOne({ _id: transaction.user }, { $inc: { balance: transaction.amount } });
    }
    if (transaction.eventType === 'withdrawal' && nextStatus === 'Failed') {
      await User.updateOne({ _id: transaction.user }, { $inc: { balance: transaction.amount } });
    }
    await invalidateCache(req.redisClient, `user:${transaction.user}`);
    res.json({ success: true, data: toTransactionDto(transaction) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not review request.' });
  }
};

const getAdminOverview = async (_req, res) => {
  try {
    const [userCount, depositStats, withdrawalStats, activeInvestments, recentUsers, pendingRequests] = await Promise.all([
      User.countDocuments(),
      Transaction.aggregate([{ $match: { eventType: 'deposit', status: 'Completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { eventType: 'withdrawal', status: 'Completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Investment.countDocuments({ status: 'Active' }),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email role createdAt'),
      Transaction.find({ eventType: { $in: ['deposit', 'withdrawal'] }, status: 'Pending' }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(10),
    ]);
    res.json({
      success: true,
      data: {
        metrics: {
          totalUsers: userCount,
          totalDeposits: depositStats[0]?.total || 0,
          totalWithdrawals: withdrawalStats[0]?.total || 0,
          activeInvestments,
        },
        recentUsers: recentUsers.map((user) => ({
          id: String(user._id),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          plan: 'No active plan',
          status: 'Active',
        })),
        pendingRequests: pendingRequests.map((item) => ({
          ...toTransactionDto(item),
          user: item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Unknown user',
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load admin overview.' });
  }
};

const listAllUsers = async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load users.' });
  }
};

const getAdminUserDetail = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 400, 'Invalid user id.');
  try {
    const [user, transactions] = await Promise.all([
      User.findById(req.params.id),
      Transaction.find({ user: req.params.id }).sort({ createdAt: -1 }),
    ]);
    if (!user) return sendError(res, 404, 'User not found.');
    res.json({ success: true, data: { user, transactions: transactions.map(toTransactionDto) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load user account activity.' });
  }
};

const updateSettings = async (req, res) => {
  const fields = ['firstName', 'lastName', 'phone', 'dob', 'country', 'streetAddress', 'city', 'state', 'postalCode', 'jobTitle', 'company', 'bio', 'timezone'];
  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 404, 'User not found.');
    for (const field of fields) {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    }
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const allowed = ['emailAlerts', 'securityAlerts', 'weeklyReport', 'marketingEmails', 'twoFactorEnabled'];
      for (const key of allowed) {
        if (typeof req.body.preferences[key] === 'boolean') user.preferences[key] = req.body.preferences[key];
      }
    }
    await user.save();
    await invalidateCache(req.redisClient, `user:${user._id}`);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Could not save account settings.' });
  }
};

module.exports = {
  getDashboard,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listInvestments,
  createInvestment,
  getPortfolio,
  listTransactions,
  listDepositMethods,
  createDepositMethod,
  listDeposits,
  createDeposit,
  listWithdrawals,
  createWithdrawal,
  reviewTransaction,
  getAdminOverview,
  listAllUsers,
  getAdminUserDetail,
  updateSettings,
};
