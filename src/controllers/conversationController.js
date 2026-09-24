const Conversation = require('../models/Conversation');


// CREATE / GET CONVERSATION
const createConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID required',
      });
    }

    const existingConversation = await Conversation.findOne({
      members: { $all: [req.user._id, receiverId] },
    });

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        data: existingConversation,
      });
    }

    const conversation = await Conversation.create({
      members: [req.user._id, receiverId],
    });

    return res.status(201).json({
      success: true,
      message: 'Conversation created',
      data: conversation,
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


// GET USER CONVERSATIONS
const getUserConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      members: req.user._id,
    }).populate('members', 'username avatar');

    return res.status(200).json({
      success: true,
      data: conversations,
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
  createConversation,
  getUserConversations,
};