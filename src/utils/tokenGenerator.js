const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Otp = require('../models/Otp');

/**
 * Generate Access Token (Short-lived)
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',
    }
  );
};

/**
 * Generate Refresh Token (Long-lived) and Set HTTP-Only Cookie
 */
const generateRefreshToken = (user, res) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

  const refreshToken = jwt.sign(
    {
      userId: user._id,
    },
    secret,
    {
      expiresIn: '7d',
    }
  );

  if (res) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  return refreshToken;
};

/**
 * Generate 6-digit OTP and Upsert into Database
 */
const generateAndSaveOTP = async (email) => {
  // 100000 to 1000000 guarantees a full 6-digit integer (100000 - 999999)
  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // Atomic Upsert: Update if email exists, create if it does not
  await Otp.findOneAndUpdate(
    { email },
    {
      otpCode: otp,
      otpExpires: expiresAt,
      verifiedAt: null,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return otp;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAndSaveOTP,
};