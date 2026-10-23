import { initSocket } from "../config/socket.js";
import { socketAuthMiddleware } from "./socket.middleware.js";
import { getUserRoom, getCompanyRoom, getBranchRoom } from "./socket.rooms.js";

export const initSockets = (httpServer) => {
  const io = initSocket(httpServer);

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const { id: userId, name, email, companyId, branchId } = socket.user;

    // Join isolated rooms
    if (userId) socket.join(getUserRoom(userId));
    if (companyId) socket.join(getCompanyRoom(companyId));
    if (branchId) socket.join(getBranchRoom(branchId));

    const userLabel = name || email || `User #${userId}`;
    console.log(`✅ Socket connected: ${userLabel} (User ID: ${userId}, Socket ID: ${socket.id})`);

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${userLabel} (Reason: ${reason})`);
    });
  });

  return io;
};
