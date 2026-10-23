import { Server } from "socket.io";

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile/curl/local) or reflect request origin
        callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  return io;
};

export const getIO = () => {
  return io;
};
