const Message = require('../models/Message');
const Conversation = require('../models/Conversation');


// SEND MESSAGE
const sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;

    if (!conversationId || !text) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID and text required',
      });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text,
      lastMessageAt: Date.now(),
    });

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// GET MESSAGES
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversation: req.params.conversationId,
    }).populate('sender', 'username avatar');

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
};