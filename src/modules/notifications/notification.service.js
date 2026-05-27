import mongoose from "mongoose";
import { Notification } from "./notification.model.js";
import { sendEmail as sendMail } from "../../utils/mailer.js";
import { emitNotificationNew } from "../../sockets/notificationSocket.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination } from "../../utils/pagination.js";

/**
 * @param {{ userId: string; type: string; title: string; body: string; ticketId?: string | null }} params
 */
export async function createNotification(params) {
  const doc = await Notification.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    type: params.type,
    title: params.title,
    body: params.body,
    isRead: false,
    ticketId: params.ticketId ? new mongoose.Types.ObjectId(params.ticketId) : null
  });

  try {
    emitNotificationNew(String(params.userId), doc);
  } catch {
    /* Socket.IO not initialized */
  }

  return doc;
}

/**
 * Sends transactional email templates (Nodemailer). Used by tickets/auth workflows.
 * @param {string} to
 * @param {string} template
 * @param {Record<string, unknown>} data
 */
export async function sendEmail(to, template, data) {
  if (template === "assignment") {
    const ticketNumber = String(data.ticketNumber || "");
    const title = String(data.title || "");
    await sendMail({
      to,
      subject: `Ticket ${ticketNumber} assigned to you`,
      text: `You have been assigned ticket ${ticketNumber}: ${title}`
    });
    return;
  }

  if (template === "escalation_customer") {
    const ticketNumber = String(data.ticketNumber || "");
    await sendMail({
      to,
      subject: `Ticket ${ticketNumber} update`,
      text:
        "Your ticket is being reviewed by a specialist team. We'll update you as soon as we have more information."
    });
    return;
  }

  if (template === "ticket_update") {
    await sendMail({
      to,
      subject: String(data.subject || "Ticket update"),
      text: String(data.text || "")
    });
    return;
  }
}

/**
 * @param {string} userId
 * @param {{ page?: number; limit?: number; isRead?: boolean }} options
 */
export async function listForUser(userId, options = {}) {
  const { page, limit, skip } = getPagination(options.page ?? 1, options.limit ?? 20);
  const query = { userId: new mongoose.Types.ObjectId(userId) };

  if (options.isRead !== undefined) {
    query.isRead = options.isRead;
  }

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId: query.userId, isRead: false })
  ]);

  return { items, total, page, limit, unreadCount };
}

export async function markAsRead(notificationId, userId) {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId: new mongoose.Types.ObjectId(userId) },
    { $set: { isRead: true } },
    { new: true }
  );

  if (!doc) throw new ApiError(404, "Notification not found");
  return doc;
}

export async function markAllAsRead(userId) {
  const result = await Notification.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), isRead: false },
    { $set: { isRead: true } }
  );

  return { modifiedCount: result.modifiedCount };
}

export async function deleteNotification(notificationId, userId) {
  const doc = await Notification.findOneAndDelete({
    _id: notificationId,
    userId: new mongoose.Types.ObjectId(userId)
  });

  if (!doc) throw new ApiError(404, "Notification not found");
  return { success: true };
}
