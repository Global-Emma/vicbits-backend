const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    // --- Personal Details ---
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },

    // --- Address Details ---
    country: {
      type: String,
      default: 'United States',
      trim: true,
    },
    streetAddress: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },

    // --- Investor Profile ---
    investorType: {
      type: String,
      enum: [
        'Individual Investor',
        'Institutional Investor',
        'Accredited Investor',
        'Corporate / Entity',
      ],
      default: 'Individual Investor',
    },
    targetCapital: {
      type: String,
      default: '$10,000 - $50,000',
    },

    // --- Authentication & Security ---
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Prevents password from returning in queries by default
    },
    role: {
      type: String,
      enum: ['investor', 'admin', 'manager'],
      default: 'investor',
    },
    kycStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    acceptedTerms: {
      type: Boolean,
      required: true,
    },

    // --- Referrals & System ---
    referralCode: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default:
        'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    refreshToken: {
      type: String,
    },

    // --- Montary & Investment Details ---
    totalInvested: {
      type: String,
      default: '0',
    },
    totalReturns: {
      type: String,
      default: '0',
    },
    balance: {
      type: String,
      default: '0',
    },
    
  },
  {
    timestamps: true,
  }
);

// --- Pre-save Hook: Hash Password ---
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next;
  } catch (error) {
    throw new Error('Error hashing password: ' + error.message);
  }
});

// --- Method: Compare Password ---
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// --- Remove Sensitive Data in JSON responses ---
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  return user;
};

module.exports = mongoose.model('User', userSchema);