import { getIO } from "../config/socket.js";

/**
 * @param {string} userId
 * @param {unknown} notification
 */
export function emitNotificationNew(userId, notification) {
  const payload =
    typeof notification.toObject === "function"
      ? { notification: notification.toObject() }
      : { notification };

  getIO().to(`user:${userId}`).emit("notification:new", payload);
}
