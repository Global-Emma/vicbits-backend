let io;

const setIo = (socketIo) => {
  io = socketIo;
};

const emitNotification = (userId, notification) => {
  if (io) {
    io.to(userId.toString()).emit("notification", notification);
  }
};

module.exports = {
  setIo,
  emitNotification,
};