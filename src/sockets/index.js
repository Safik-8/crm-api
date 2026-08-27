import { initSocket } from "../config/socket.js";
import { socketAuthMiddleware } from "./socket.middleware.js";
import { getUserRoom, getCompanyRoom, getBranchRoom } from "./socket.rooms.js";

export const initSockets = (httpServer) => {
  const io = initSocket(httpServer);

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const { id: userId, companyId, branchId } = socket.user;

    // Join isolated rooms
    if (userId) socket.join(getUserRoom(userId));
    if (companyId) socket.join(getCompanyRoom(companyId));
    if (branchId) socket.join(getBranchRoom(branchId));

    socket.on("disconnect", () => {
      // Clean up on disconnect if needed
    });
  });

  return io;
};
