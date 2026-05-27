import mongoose from "mongoose";
import { Message } from "./message.model.js";
import { Ticket } from "../tickets/ticket.model.js";
import { User } from "../users/user.model.js";
import * as auditLogService from "../auditlogs/auditlog.service.js";
import * as notificationService from "../notifications/notification.service.js";
import * as messageSocket from "../../sockets/messageSocket.js";
import { assertTicketVisible } from "../tickets/ticket.service.js";
import { ApiError } from "../../utils/ApiError.js";

/** @param {() => void} fn */
function socketSafe(fn) {
  try {
    fn();
  } catch {
    /* Socket.IO may be unavailable */
  }
}

/** @param {string | null | undefined} id */
function toOid(id) {
  if (!id) return null;
  return new mongoose.Types.ObjectId(id);
}

/** @param {{ id: string; role: string; teamId: string | null }} user */
function threadFilter(user) {
  if (user.role === "customer") return { isInternal: false };
  return {};
}

export async function getThread(ticketId, user) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const filter = { ticketId: toOid(ticketId), ...threadFilter(user) };
  return Message.find(filter)
    .sort({ createdAt: 1 })
    .populate("senderId", "name email role avatar")
    .lean();
}

export async function createMessage(ticketId, input, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (ticket.status === "closed") {
    throw new ApiError(400, "Cannot post messages on a closed ticket");
  }

  const isInternal = Boolean(input.isInternal);
  if (isInternal && user.role === "customer") {
    throw new ApiError(403, "Customers cannot post internal notes");
  }

  const message = await Message.create({
    ticketId: toOid(ticketId),
    senderId: toOid(user.id),
    senderRole: user.role,
    content: input.content,
    isInternal,
    attachments: input.attachments || []
  });

  await auditLogService.log({
    action: "message.created",
    actorId: user.id,
    actorRole: user.role,
    targetId: String(ticketId),
    targetModel: "Ticket",
    before: null,
    after: { messageId: String(message._id), isInternal },
    req
  });

  const customerKey = String(ticket.customerId?._id ?? ticket.customerId);
  const candidateIds = new Set(
    [customerKey, ticket.assignedAgentId ? String(ticket.assignedAgentId) : null]
      .concat((ticket.watchers || []).map(String))
      .filter(Boolean)
  );

  candidateIds.delete(String(user.id));

  for (const uid of candidateIds) {
    if (isInternal) {
      const targetUser = await User.findById(uid).select("role").lean();
      if (!targetUser || targetUser.role === "customer") continue;
    }

    await notificationService.createNotification({
      userId: uid,
      type: "message_received",
      title: "New ticket message",
      body: `New message on ticket ${ticket.ticketNumber}`,
      ticketId: String(ticket._id)
    });
  }

  socketSafe(() => messageSocket.emitMessageNew(ticket, message));

  return message;
}

export async function markAsRead(ticketId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const uid = toOid(user.id);
  const filter = { ticketId: toOid(ticketId), ...threadFilter(user) };

  await Message.updateMany(filter, { $addToSet: { readBy: uid } });

  await auditLogService.log({
    action: "message.thread_read",
    actorId: user.id,
    actorRole: user.role,
    targetId: String(ticketId),
    targetModel: "Ticket",
    before: null,
    after: { ticketId: String(ticketId) },
    req
  });

  return { success: true };
}

export async function updateMessage(ticketId, messageId, content, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const message = await Message.findOne({
    _id: messageId,
    ticketId: toOid(ticketId),
    ...threadFilter(user)
  });

  if (!message) throw new ApiError(404, "Message not found");
  if (!message.senderId.equals(toOid(user.id))) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (ageMs > 10 * 60 * 1000) {
    throw new ApiError(400, "Messages can only be edited within 10 minutes");
  }

  const before = { content: message.content };
  message.content = content;
  await message.save();

  await auditLogService.log({
    action: "message.updated",
    actorId: user.id,
    actorRole: user.role,
    targetId: String(ticketId),
    targetModel: "Ticket",
    before,
    after: { messageId: String(message._id), content },
    req
  });

  return message;
}

export async function deleteMessage(ticketId, messageId, user, req) {
  if (user.role !== "admin") throw new ApiError(403, "Only admins can delete messages");

  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const message = await Message.findOne({ _id: messageId, ticketId: toOid(ticketId) });
  if (!message) throw new ApiError(404, "Message not found");

  const before = { messageId: String(message._id), content: message.content };
  await Message.deleteOne({ _id: message._id });

  await auditLogService.log({
    action: "message.deleted",
    actorId: user.id,
    actorRole: user.role,
    targetId: String(ticketId),
    targetModel: "Ticket",
    before,
    after: null,
    req
  });

  return { success: true };
}
