const express = require('express');
const router = express.Router();

const {
  sendOtp,
  verifyOtp,
  registerUser,
  loginUser,
  getUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  userLogout,
  getAllUsers,
  editUserProfile,
} = require('../controllers/authController');

const { protect, authorize } = require('../middlewares/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/profile', protect, getUserProfile);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.put('/change-password', protect, changePassword);
router.put('/update-profile', protect, editUserProfile);

router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.post('/refresh-token', refreshToken);
router.post('/logout', protect, userLogout)

module.exports = router;