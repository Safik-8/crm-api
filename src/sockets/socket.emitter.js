import { getIO } from "../config/socket.js";
import { getUserRoom, getCompanyRoom, getBranchRoom } from "./socket.rooms.js";

export const emitToUser = (userId, event, payload) => {
  try {
    const io = getIO();
    if (io) {
      io.to(getUserRoom(userId)).emit(event, payload);
    }
  } catch (err) {
    console.error(`[SocketEmitter] Failed to emit to user ${userId}:`, err.message);
  }
};

export const emitToCompany = (companyId, event, payload) => {
  try {
    const io = getIO();
    if (io && companyId) {
      io.to(getCompanyRoom(companyId)).emit(event, payload);
    }
  } catch (err) {
    console.error(`[SocketEmitter] Failed to emit to company ${companyId}:`, err.message);
  }
};

export const emitToBranch = (branchId, event, payload) => {
  try {
    const io = getIO();
    if (io && branchId) {
      io.to(getBranchRoom(branchId)).emit(event, payload);
    }
  } catch (err) {
    console.error(`[SocketEmitter] Failed to emit to branch ${branchId}:`, err.message);
  }
};
