import { verifyAccessToken } from "../utils/tokenUtils.js";
import prisma from "../config/db.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    // 1. Try handshake auth token, 2. Try Authorization header, 3. Try httpOnly cookie
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookieToken = cookieHeader
      ?.split(";")
      ?.map((c) => c.trim())
      ?.find((c) => c.startsWith("accessToken="))
      ?.split("=")[1];

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
      cookieToken;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    const payload = verifyAccessToken(token);
    if (!payload?.userId) {
      return next(new Error("Authentication error: Invalid token payload"));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, companyId: true, branchId: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new Error("Authentication error: User inactive or not found"));
    }

    socket.user = {
      id: user.id,
      companyId: user.companyId,
      branchId: user.branchId,
    };

    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
};
