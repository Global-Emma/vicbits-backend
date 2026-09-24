const express = require('express');
const router = express.Router();

const {
  createConversation,
  getUserConversations,
} = require('../controllers/conversationController');
const { protect } = require('../middlewares/authMiddleware');
const {
  getMessages,
  sendMessage,
} = require('../controllers/messageController');


router.post('/', protect, createConversation);
router.post('/messages', protect, sendMessage);
router.get('/', protect, getUserConversations);
router.get(
  "/messages/:conversationId",
  protect,
  getMessages
);

module.exports = router;