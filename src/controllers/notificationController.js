const Notification = require('../models/Notification');
const { invalidateCache } = require('../utils/validation');

// =======================
// GET USER NOTIFICATIONS
// =======================
const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.log('Error in getUserNotifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// =======================
// MARK NOTIFICATION AS READ
// =======================
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check if user owns this notification
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await invalidateCache(req.redisClient, `notifications:${req.user._id}`);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.log('Error in markAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// =======================
// MARK ALL NOTIFICATIONS AS READ
// =======================
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    await invalidateCache(req.redisClient, `notifications:${req.user._id}`);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.log('Error in markAllAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// =======================
// CREATE NOTIFICATION HELPER
// =======================
const createNotification = async (userId, type, title, message, relatedId, redisClient) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      relatedId,
    });

    // Invalidate cache
    await invalidateCache(redisClient, `notifications:${userId}`);

    return notification;
  } catch (error) {
    console.log('Error creating notification:', error);
    return null;
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
};