const crypto = require('crypto');
const User = require('../models/User');

const createInviteCode = () => `VIC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const getOrCreateInviteCode = async (userId) => {
  const existingUser = await User.findById(userId).select('inviteCode').lean();
  if (!existingUser) throw new Error('Investor account not found while creating referral code.');
  if (existingUser.inviteCode) return existingUser.inviteCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();
    try {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          $or: [
            { inviteCode: { $exists: false } },
            { inviteCode: null },
            { inviteCode: '' },
          ],
        },
        { $set: { inviteCode } },
        { new: true }
      ).select('inviteCode').lean();

      if (updatedUser?.inviteCode) return updatedUser.inviteCode;

      const currentUser = await User.findById(userId).select('inviteCode').lean();
      if (!currentUser) throw new Error('Investor account not found while creating referral code.');
      if (currentUser.inviteCode) return currentUser.inviteCode;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  throw new Error('Could not generate a unique referral code.');
};

module.exports = { createInviteCode, getOrCreateInviteCode };
