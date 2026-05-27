import { getIO } from "../config/socket.js";

/**
 * @param {unknown} doc
 */
function serializeMessage(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    _id: o._id,
    ticketId: o.ticketId,
    senderId: o.senderId,
    senderRole: o.senderRole,
    content: o.content,
    isInternal: o.isInternal,
    attachments: o.attachments,
    readBy: o.readBy,
    createdAt: o.createdAt
  };
}

/**
 * Internal notes are never broadcast to the customer ticket room.
 * @param {import("mongoose").Document | Record<string, unknown>} ticket
 * @param {import("mongoose").Document | Record<string, unknown>} message
 */
export function emitMessageNew(ticket, message) {
  const io = getIO();
  const ticketId = String(ticket._id);
  const msgPayload = { message: serializeMessage(message) };

  if (message.isInternal) {
    const teams = new Set();
    if (ticket.assignedTeamId) teams.add(String(ticket.assignedTeamId));
    if (ticket.escalatedToTeamId) teams.add(String(ticket.escalatedToTeamId));

    for (const tid of teams) {
      io.to(`team:${tid}`).emit("message:new", msgPayload);
    }
    io.to("role:manager").emit("message:new", msgPayload);
    io.to("role:admin").emit("message:new", msgPayload);
    return;
  }

  io.to(`ticket:${ticketId}`).emit("message:new", msgPayload);
}
