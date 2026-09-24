const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { createNotification } = require("../controllers/notificationController");
const { setIo, emitNotification } = require("../utils/notificationService");

const initSocket = (server, redisClient) => {
  const io = new Server(server, {
    cors: {
      origin: "https://freemp.vercel.app",
      credentials: true,
    },
  });

  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      console.log('Socket Authenticated User:', user.username);

      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `${socket.user.username} Connected`
    );

    socket.join(socket.user._id.toString());

    socket.on(
      "sendMessage",
      async ({
        conversationId,
        receiverId,
        text,
      }) => {
        try {
          const newMessage =
            await Message.create({
              conversation:
                conversationId,
              sender:
                socket.user._id,
              text,
            });

          await Conversation.findByIdAndUpdate(
            conversationId,
            {
              lastMessage: text,
              lastMessageAt:
                Date.now(),
            }
          );

          const populatedMessage =
            await Message.findById(
              newMessage._id
            ).populate(
              "sender",
              "username avatar"
            );

          io.to(receiverId).emit(
            "newMessage",
            populatedMessage
          );

          io.to(
            socket.user._id.toString()
          ).emit(
            "newMessage",
            populatedMessage
          );

          // Create notification for receiver
          await createNotification(
            receiverId,
            'new_message',
            'New Message',
            `You have a new message from ${socket.user.username}`,
            conversationId,
            redisClient
          );

          // Emit notification to receiver
          emitNotification(receiverId, {
            type: 'new_message',
            title: 'New Message',
            message: `You have a new message from ${socket.user.username}`,
            relatedId: conversationId,
          });
        } catch (error) {
          console.log(error);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(
        `${socket.user.username} disconnected`
      );
    });
  });
};

module.exports = initSocket;