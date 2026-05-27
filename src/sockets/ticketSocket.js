import { getIO } from "../config/socket.js";

/**
 * @param {unknown} doc
 */
function serializeTicket(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    _id: o._id,
    ticketNumber: o.ticketNumber,
    title: o.title,
    status: o.status,
    priority: o.priority,
    category: o.category,
    customerId: o.customerId,
    assignedAgentId: o.assignedAgentId,
    assignedTeamId: o.assignedTeamId,
    escalatedToTeamId: o.escalatedToTeamId
  };
}

/**
 * @param {import("mongoose").Document | Record<string, unknown>} ticket
 */
export function emitTicketCreated(ticket) {
  const io = getIO();
  const payload = { ticket: serializeTicket(ticket) };
  const teamId = ticket.assignedTeamId ? String(ticket.assignedTeamId) : null;

  if (teamId) {
    io.to(`team:${teamId}`).emit("ticket:created", payload);
  }
  io.to("role:manager").emit("ticket:created", payload);
  io.to("role:admin").emit("ticket:created", payload);
}

/**
 * @param {string} ticketId
 * @param {Record<string, unknown>} changes
 */
export function emitTicketUpdated(ticketId, changes) {
  getIO().to(`ticket:${ticketId}`).emit("ticket:updated", { ticketId, changes });
}

/**
 * @param {string} ticketId
 * @param {string} status
 */
export function emitTicketStatusChanged(ticketId, status) {
  getIO().to(`ticket:${ticketId}`).emit("ticket:status-changed", { ticketId, status });
}

/**
 * @param {import("mongoose").Document | Record<string, unknown>} ticket
 * @param {string} agentId
 * @param {string} teamId
 */
export function emitTicketAssigned(ticket, agentId, teamId) {
  const io = getIO();
  const payload = { ticket: serializeTicket(ticket) };
  io.to(`user:${agentId}`).emit("ticket:assigned", payload);
  io.to(`team:${teamId}`).emit("ticket:assigned", payload);
}

/**
 * @param {import("mongoose").Document | Record<string, unknown>} ticket
 * @param {string | null | undefined} originTeamId
 * @param {string} targetTeamId
 */
export function emitTicketEscalated(ticket, originTeamId, targetTeamId) {
  const io = getIO();
  const payload = { ticket: serializeTicket(ticket) };

  if (originTeamId && String(originTeamId) !== String(targetTeamId)) {
    io.to(`team:${originTeamId}`).emit("ticket:escalated", payload);
  }
  io.to(`team:${targetTeamId}`).emit("ticket:escalated", payload);
  io.to("role:manager").emit("ticket:escalated", payload);
}

/**
 * @param {string} ticketId
 * @param {string} customerId
 */
export function emitTicketResolved(ticketId, customerId) {
  const io = getIO();
  io.to(`ticket:${ticketId}`).emit("ticket:resolved", { ticketId });
  io.to(`user:${customerId}`).emit("ticket:resolved", { ticketId });
}
