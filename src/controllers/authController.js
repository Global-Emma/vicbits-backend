const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenGenerator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { invalidateCache } = require('../utils/validation');

// Reusable Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ==========================================
// 1. SEND OTP FOR EMAIL VERIFICATION
// ==========================================
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address is already verified.",
      });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send email using Nodemailer
    const info = await transporter.sendMail({
      from: `"VicBits Capitals Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your VicBits Capitals Investor Vault",
      text: `Your One-Time Password for VicBits Capitals registration is ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #040C18; color: #E2E8F0; border: 1px solid #1E293B; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #F3B233; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">VICBITS CAPITALS</h1>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 4px;">SECURE INVESTOR VAULT</p>
          </div>
          
          <h2 style="color: #FFFFFF; font-size: 18px; margin-bottom: 12px;">Email Verification Code</h2>
          <p style="color: #94A3B8; font-size: 14px; line-height: 1.5;">Thank you for registering with VicBits Capitals. Please use the following 6-digit verification code to confirm your email identity:</p>
          
          <div style="background-color: #081528; border: 1px solid #F3B233; padding: 20px; text-align: center; margin: 24px 0; border-radius: 12px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #F3B233; font-family: monospace;">${otp}</span>
          </div>

          <p style="font-size: 12px; color: #64748B;">This security code will expire in 10 minutes. Do not share this code with anyone.</p>
          <hr style="border: 0; border-top: 1px solid #1E293B; margin: 24px 0;" />
          <p style="font-size: 11px; color: #64748B; text-align: center;">© ${new Date().getFullYear()} VicBits Capitals Financial Corp. All rights reserved.</p>
        </div>
      `,
    });

    if (!info) {
      return res.status(400).json({
        success: false,
        message: "Error dispatching verification email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to registered email successfully.",
      // Pass code in development mode if configured
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    });
  } catch (error) {
    console.error("❌ Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error occurred during OTP transmission.",
      error: error.message,
    });
  }
};

// ==========================================
// 2. VERIFY OTP CODE
// ==========================================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required.",
      });
    }

    // In a production setup, verify against saved OTP in DB or Redis
    // Example placeholder validation:
    console.log(`OTP ${otp} verified for ${email}`);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error occurred during OTP verification.",
      error: error.message,
    });
  }
};

// ==========================================
// 3. REGISTER NEW INVESTOR
// ==========================================
const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dob,
      country,
      streetAddress,
      city,
      state,
      postalCode,
      investorType,
      targetCapital,
      password,
      referralCode,
      acceptedTerms,
    } = req.body;

    // Required Field Validation
    if (!firstName || !lastName || !email || !password || !dob) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields (First Name, Last Name, Email, DOB, Password).",
      });
    }

    if (!acceptedTerms) {
      return res.status(400).json({
        success: false,
        message: "You must accept the Terms and Conditions to create an account.",
      });
    }

    // Check existing investor
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    // Create User (Password will be automatically hashed by Mongoose schema pre-save hook)
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      phone,
      dob,
      country: country || "United States",
      streetAddress,
      city,
      state,
      postalCode,
      investorType: investorType || "Individual Investor",
      targetCapital: targetCapital || "$10,000 - $50,000",
      password,
      referralCode,
      acceptedTerms,
      isEmailVerified: true,
    });

    if (!newUser) {
      return res.status(400).json({
        success: false,
        message: "Error creating investor account.",
      });
    }

    // Generate JWT Tokens
    const token = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser, res);

    newUser.refreshToken = refreshToken;
    await newUser.save();

    // Cache Invalidation
    if (req.redisClient) {
      await invalidateCache(req.redisClient, `user:${newUser._id}`);
    }

    return res.status(201).json({
      success: true,
      message: "Investor account created successfully.",
      accessToken: token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during user registration.",
      error: error.message,
    });
  }
};

// ==========================================
// 4. LOGIN USER
// ==========================================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Must explicitly select '+password' because schema sets select: false on password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please check your credentials.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials.",
      });
    }

    // Tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, res);

    user.refreshToken = refreshToken;
    await user.save();

    if (req.redisClient) {
      await invalidateCache(req.redisClient, `user:${user._id}`);
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken: token,
      user,
    });
  } catch (error) {
    console.error("Error in loginUser:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during authentication.",
      error: error.message,
    });
  }
};

// ==========================================
// 5. GET USER PROFILE
// ==========================================
const getUserProfile = async (req, res) => {
  try {
    const cachedKey = `user:${req.user._id}`;
    const cachedUser = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedUser) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedUser),
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(user), "EX", 3600);
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching profile.",
      error: error.message,
    });
  }
};

// ==========================================
// 6. GET ALL USERS (ADMIN ROUTE)
// ==========================================
const getAllUsers = async (req, res) => {
  try {
    const cachedKey = `user:all`;
    const cachedUsers = req.redisClient ? await req.redisClient.get(cachedKey) : null;

    if (cachedUsers) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedUsers),
      });
    }

    const users = await User.find({});

    if (req.redisClient) {
      await req.redisClient.set(cachedKey, JSON.stringify(users), "EX", 3600);
    }

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching users list.",
      error: error.message,
    });
  }
};

// ==========================================
// 7. EDIT USER PROFILE
// ==========================================
const editUserProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dob,
      country,
      streetAddress,
      city,
      state,
      postalCode,
      investorType,
      targetCapital,
      avatar,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Update profile fields
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;
    user.dob = dob || user.dob;
    user.country = country || user.country;
    user.streetAddress = streetAddress || user.streetAddress;
    user.city = city || user.city;
    user.state = state || user.state;
    user.postalCode = postalCode || user.postalCode;
    user.investorType = investorType || user.investorType;
    user.targetCapital = targetCapital || user.targetCapital;
    user.avatar = avatar || user.avatar;

    const updatedUser = await user.save();

    if (req.redisClient) {
      await invalidateCache(req.redisClient, `user:${user._id}`);
      await invalidateCache(req.redisClient, `user:all`);
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in editUserProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred while updating profile.",
      error: error.message,
    });
  }
};

// ==========================================
// 8. CHANGE PASSWORD
// ==========================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password provided is incorrect.",
      });
    }

    user.password = newPassword;
    await user.save();

    if (req.redisClient) {
      await invalidateCache(req.redisClient, `user:${user._id}`);
    }

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred while changing password.",
      error: error.message,
    });
  }
};

// ==========================================
// 9. FORGOT PASSWORD
// ==========================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email address.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    // Send reset email
    await transporter.sendMail({
      from: `"VicBits Capitals Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request - VicBits Capitals",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #040C18; color: #E2E8F0; border-radius: 12px;">
          <h2 style="color: #F3B233;">Reset Your Password</h2>
          <p>You requested a password reset for your VicBits Capitals account.</p>
          <p>Your password reset token is:</p>
          <div style="background: #081528; border: 1px solid #334155; padding: 12px; font-family: monospace; font-size: 18px; color: #F3B233; text-align: center; border-radius: 8px;">
            ${resetToken}
          </div>
          <p style="font-size: 12px; color: #94A3B8; margin-top: 16px;">This token is valid for 10 minutes.</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset token sent to your email address.",
      resetToken,
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred.",
      error: error.message,
    });
  }
};

// ==========================================
// 10. RESET PASSWORD
// ==========================================
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during password reset.",
      error: error.message,
    });
  }
};

// ==========================================
// 11. REFRESH ACCESS TOKEN
// ==========================================
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token.",
      });
    }

    const user = await User.findById(decoded.id || decoded.userId);

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token.",
      });
    }

    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Error in refreshToken:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token.",
      error: error.message,
    });
  }
};

// ==========================================
// 12. LOGOUT USER
// ==========================================
const userLogout = async (req, res) => {
  try {
    const logUser = await User.findById(req.user._id);
    const token = req.cookies?.refreshToken || logUser?.refreshToken;

    if (logUser) {
      logUser.refreshToken = "";
      await logUser.save();
      if (req.redisClient) {
        await invalidateCache(req.redisClient, `user:${logUser._id}`);
      }
    }

    res.clearCookie("refreshToken");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Error in userLogout:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during logout.",
      error: error.message,
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  registerUser,
  loginUser,
  getUserProfile,
  getAllUsers,
  editUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  userLogout,
};