import mongoose from "mongoose";
import { Ticket } from "./ticket.model.js";
import { Team } from "../teams/team.model.js";
import { User } from "../users/user.model.js";
import { Message } from "../messages/message.model.js";
import { AuditLog } from "../auditlogs/auditlog.model.js";
import * as auditLogService from "../auditlogs/auditlog.service.js";
import * as notificationService from "../notifications/notification.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination } from "../../utils/pagination.js";
import * as ticketSocket from "../../sockets/ticketSocket.js";

/**
 * @param {() => void} fn
 */
function socketSafe(fn) {
  try {
    fn();
  } catch {
    /* Socket.IO may be unavailable during isolated imports/tests */
  }
}

/**
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 */
function diffSnapshots(before, after) {
  /** @type {Record<string, { from: unknown; to: unknown }>} */
  const changes = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}

/** @param {string | null | undefined} id */
function toOid(id) {
  if (!id) return null;
  return new mongoose.Types.ObjectId(id);
}

/** @param {{ id: string; role: string; teamId: string | null }} user */
export function buildListFilter(user) {
  const uid = toOid(user.id);
  if (user.role === "admin") return {};
  if (user.role === "customer") return { customerId: uid };

  const tid = user.teamId ? toOid(user.teamId) : null;
  if (!tid) return { _id: new mongoose.Types.ObjectId("000000000000000000000001") };

  if (user.role === "manager") {
    return { $or: [{ assignedTeamId: tid }, { escalatedToTeamId: tid }] };
  }

  return {
    $or: [
      { customerId: uid },
      { assignedAgentId: uid },
      { assignedTeamId: tid },
      { watchers: uid },
      { escalatedToTeamId: tid }
    ]
  };
}

/** @param {import("mongoose").Document} ticket */
function ticketCustomerId(ticket) {
  return ticket.customerId?._id ?? ticket.customerId;
}

/** @param {import("mongoose").Document | null} ticket @param {{ id: string; role: string; teamId: string | null }} user */
export function assertTicketVisible(ticket, user) {
  if (!ticket) throw new ApiError(404, "Ticket not found");
  const uid = toOid(user.id);
  if (user.role === "admin") return;

  const custId = ticketCustomerId(ticket);

  if (user.role === "customer") {
    if (!custId || !custId.equals(uid)) throw new ApiError(403, "Forbidden");
    return;
  }

  const tid = user.teamId ? toOid(user.teamId) : null;
  if (!tid) throw new ApiError(403, "Forbidden");

  if (user.role === "manager") {
    const ok =
      (ticket.assignedTeamId && ticket.assignedTeamId.equals(tid)) ||
      (ticket.escalatedToTeamId && ticket.escalatedToTeamId.equals(tid));
    if (!ok) throw new ApiError(403, "Forbidden");
    return;
  }

  const ok =
    (custId && custId.equals(uid)) ||
    (ticket.assignedAgentId && ticket.assignedAgentId.equals(uid)) ||
    (ticket.assignedTeamId && ticket.assignedTeamId.equals(tid)) ||
    (ticket.watchers || []).some((w) => w.equals(uid)) ||
    (ticket.escalatedToTeamId && ticket.escalatedToTeamId.equals(tid));
  if (!ok) throw new ApiError(403, "Forbidden");
}

/** @param {import("mongoose").Document} ticket */
function ticketSnapshot(ticket) {
  const cust = ticketCustomerId(ticket);
  return {
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    customerId: cust ? cust.toString() : null,
    assignedAgentId: ticket.assignedAgentId?.toString() || null,
    assignedTeamId: ticket.assignedTeamId?.toString() || null,
    escalatedToTeamId: ticket.escalatedToTeamId?.toString() || null,
    watchersKey: (ticket.watchers || [])
      .map((w) => String(w))
      .sort()
      .join(",")
  };
}

/** @param {import("express").Request} req @param {import("mongoose").Document} ticket */
async function auditTicket(req, ticket, action, before, after) {
  await auditLogService.log({
    action,
    actorId: req.user?.id || null,
    actorRole: req.user?.role || "",
    targetId: String(ticket._id),
    targetModel: "Ticket",
    before,
    after,
    req
  });
}

/** @param {import("express").Request} req */
export async function createTicket(input, user, req) {
  let customerId = input.customerId ? String(input.customerId) : null;

  if (user.role === "customer") customerId = user.id;
  else if (user.role === "agent") customerId = input.customerId || user.id;
  else if (user.role === "admin") {
    if (!customerId) throw new ApiError(400, "customerId is required");
  } else if (user.role === "manager") {
    if (!input.customerId) {
      throw new ApiError(400, "customerId is required");
    }
    customerId = String(input.customerId);
  }

  if (!customerId) throw new ApiError(400, "customerId is required");

  const customer = await User.findById(customerId).select("role isActive").lean();
  if (!customer || !customer.isActive) throw new ApiError(400, "Invalid customer");
  if (customer.role !== "customer") throw new ApiError(400, "customerId must reference a customer user");

  let assignedTeamId = input.assignedTeamId ? String(input.assignedTeamId) : null;
  if (user.role === "agent" && user.teamId) assignedTeamId = assignedTeamId || user.teamId;

  if (assignedTeamId) {
    const team = await Team.findById(assignedTeamId).select("isActive").lean();
    if (!team || team.isActive === false) throw new ApiError(400, "Invalid assigned team");
  }

  const ticket = await Ticket.create({
    title: input.title,
    description: input.description,
    priority: input.priority || "medium",
    category: input.category,
    customerId,
    assignedTeamId: assignedTeamId ? toOid(assignedTeamId) : null,
    attachments: input.attachments || [],
    tags: input.tags || []
  });

  await auditTicket(req, ticket, "ticket.created", null, ticketSnapshot(ticket));

  await notificationService.createNotification({
    userId: customerId,
    type: "ticket_created",
    title: "Ticket created",
    body: `Your ticket ${ticket.ticketNumber} was created successfully.`,
    ticketId: String(ticket._id)
  });

  socketSafe(() => ticketSocket.emitTicketCreated(ticket));

  return ticket;
}

/** @param {import("express").Request} req */
export async function updateTicket(ticketId, input, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (ticket.status === "closed") throw new ApiError(400, "Closed tickets cannot be updated");

  if (user.role === "customer" && !["open", "pending", "in_progress"].includes(ticket.status)) {
    throw new ApiError(400, "This ticket can no longer be edited by the customer");
  }

  const before = ticketSnapshot(ticket);

  if (input.title !== undefined) ticket.title = input.title;
  if (input.description !== undefined) ticket.description = input.description;
  if (input.priority !== undefined) ticket.priority = input.priority;
  if (input.category !== undefined) ticket.category = input.category;
  if (input.attachments !== undefined) ticket.attachments = input.attachments;
  if (input.tags !== undefined) ticket.tags = input.tags;

  await ticket.save();
  await auditTicket(req, ticket, "ticket.updated", before, ticketSnapshot(ticket));

  const after = ticketSnapshot(ticket);
  const changes = diffSnapshots(before, after);
  socketSafe(() => {
    ticketSocket.emitTicketUpdated(String(ticket._id), changes);
    if (before.status !== after.status) {
      ticketSocket.emitTicketStatusChanged(String(ticket._id), String(after.status));
    }
  });

  return ticket;
}

export async function listTickets(filters, pagination, user) {
  const { page, limit, skip } = getPagination(pagination.page ?? 1, pagination.limit ?? 20);
  const base = buildListFilter(user);
  /** @type {Record<string, unknown>} */
  const query = { ...base };

  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;

  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) /** @type {any} */ (query.createdAt).$gte = filters.from;
    if (filters.to) /** @type {any} */ (query.createdAt).$lte = filters.to;
  }

  if (filters.teamId && (user.role === "admin" || user.role === "manager")) {
    const tid = toOid(String(filters.teamId));
    query.$and = (query.$and || []).concat([
      { $or: [{ assignedTeamId: tid }, { escalatedToTeamId: tid }] }
    ]);
  }

  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name email role")
      .populate("assignedAgentId", "name email role")
      .populate("assignedTeamId", "name slug")
      .populate("escalatedToTeamId", "name slug"),
    Ticket.countDocuments(query)
  ]);

  return { items, total, page, limit };
}

export async function getTicketById(ticketId, user) {
  const ticket = await Ticket.findById(ticketId)
    .populate("customerId", "name email role avatar")
    .populate("assignedAgentId", "name email role avatar")
    .populate("assignedTeamId", "name slug")
    .populate("escalatedToTeamId", "name slug")
    .populate("watchers", "name email role");

  assertTicketVisible(ticket, user);
  return ticket;
}

/** @param {import("express").Request} req */
export async function assignToAgent(ticketId, agentId, teamId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (ticket.status === "closed" || ticket.status === "resolved") {
    throw new ApiError(400, "Ticket is not assignable in its current status");
  }

  const team = await Team.findById(teamId).select("members isActive").lean();
  if (!team || team.isActive === false) throw new ApiError(400, "Invalid team");

  const agent = await User.findById(agentId).select("role teamId isActive email").lean();
  if (!agent || !agent.isActive || agent.role !== "agent") throw new ApiError(400, "Invalid agent");
  if (!agent.teamId || String(agent.teamId) !== String(teamId)) {
    throw new ApiError(400, "Agent is not a member of the target team");
  }
  if (!team.members.map(String).includes(String(agentId))) {
    throw new ApiError(400, "Agent is not a member of the target team");
  }

  const before = ticketSnapshot(ticket);
  ticket.assignedAgentId = toOid(agentId);
  ticket.assignedTeamId = toOid(teamId);
  ticket.status = "in_progress";
  ticket.escalatedToTeamId = null;
  ticket.escalationReason = "";
  ticket.escalatedAt = null;
  await ticket.save();

  await auditTicket(req, ticket, "ticket.assigned", before, ticketSnapshot(ticket));

  await notificationService.createNotification({
    userId: String(agentId),
    type: "ticket_assigned",
    title: "Ticket assigned",
    body: `You were assigned ticket ${ticket.ticketNumber}: ${ticket.title}`,
    ticketId: String(ticket._id)
  });

  if (agent.email) {
    await notificationService.sendEmail(agent.email, "assignment", {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title
    });
  }

  const after = ticketSnapshot(ticket);
  socketSafe(() => {
    ticketSocket.emitTicketAssigned(ticket, String(agentId), String(teamId));
    ticketSocket.emitTicketStatusChanged(String(ticket._id), ticket.status);
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function escalateTicket(ticketId, targetTeamId, reason, user, req) {
  const ticket = await Ticket.findById(ticketId).populate("customerId", "email");
  assertTicketVisible(ticket, user);

  if (["closed", "resolved", "escalated"].includes(ticket.status)) {
    throw new ApiError(400, "Ticket cannot be escalated in its current status");
  }

  const targetTeam = await Team.findById(targetTeamId).select("isActive managerId").lean();
  if (!targetTeam || targetTeam.isActive === false) throw new ApiError(400, "Invalid target team");

  const before = ticketSnapshot(ticket);
  ticket.status = "escalated";
  ticket.escalatedToTeamId = toOid(targetTeamId);
  ticket.escalationReason = reason;
  ticket.escalatedAt = new Date();
  ticket.assignedAgentId = null;

  const customerEmail =
    ticket.customerId && typeof ticket.customerId === "object" && "email" in ticket.customerId
      ? /** @type {{ email?: string }} */ (ticket.customerId).email
      : null;

  await ticket.save();

  await auditTicket(req, ticket, "ticket.escalated", before, ticketSnapshot(ticket));

  if (customerEmail) {
    await notificationService.sendEmail(customerEmail, "escalation_customer", {
      ticketNumber: ticket.ticketNumber
    });
  }

  if (targetTeam.managerId) {
    await notificationService.createNotification({
      userId: String(targetTeam.managerId),
      type: "ticket_escalated",
      title: "Ticket escalated",
      body: `Ticket ${ticket.ticketNumber} was escalated to your team: ${reason}`,
      ticketId: String(ticket._id)
    });
  }

  const after = ticketSnapshot(ticket);
  const originTeamId = before.assignedTeamId;
  socketSafe(() => {
    ticketSocket.emitTicketEscalated(ticket, originTeamId, String(targetTeamId));
    ticketSocket.emitTicketStatusChanged(String(ticket._id), ticket.status);
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function resolveTicket(ticketId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (["closed", "resolved"].includes(ticket.status)) {
    throw new ApiError(400, "Ticket is already resolved or closed");
  }

  if (user.role === "agent") {
    if (!ticket.assignedAgentId || !ticket.assignedAgentId.equals(toOid(user.id))) {
      throw new ApiError(403, "Only the assigned agent can resolve this ticket");
    }
  }

  const before = ticketSnapshot(ticket);
  ticket.status = "resolved";
  await ticket.save();

  await auditTicket(req, ticket, "ticket.resolved", before, ticketSnapshot(ticket));

  await notificationService.createNotification({
    userId: String(ticketCustomerId(ticket) || ticket.customerId),
    type: "ticket_resolved",
    title: "Ticket resolved",
    body: `Ticket ${ticket.ticketNumber} has been marked as resolved.`,
    ticketId: String(ticket._id)
  });

  const after = ticketSnapshot(ticket);
  const customerIdStr = String(ticketCustomerId(ticket) || ticket.customerId);
  socketSafe(() => {
    ticketSocket.emitTicketResolved(String(ticket._id), customerIdStr);
    ticketSocket.emitTicketStatusChanged(String(ticket._id), ticket.status);
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function reopenTicket(ticketId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (!["resolved", "closed"].includes(ticket.status)) {
    throw new ApiError(400, "Only resolved or closed tickets can be reopened");
  }
  if (user.role === "customer") throw new ApiError(403, "Customers cannot reopen tickets");

  const before = ticketSnapshot(ticket);
  ticket.status = "open";
  await ticket.save();
  await auditTicket(req, ticket, "ticket.reopened", before, ticketSnapshot(ticket));

  const after = ticketSnapshot(ticket);
  socketSafe(() => {
    ticketSocket.emitTicketStatusChanged(String(ticket._id), ticket.status);
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function closeTicket(ticketId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  if (ticket.status === "closed") throw new ApiError(400, "Ticket is already closed");
  if (user.role === "customer") throw new ApiError(403, "Customers cannot close tickets");

  const before = ticketSnapshot(ticket);
  ticket.status = "closed";
  await ticket.save();
  await auditTicket(req, ticket, "ticket.closed", before, ticketSnapshot(ticket));

  const after = ticketSnapshot(ticket);
  socketSafe(() => {
    ticketSocket.emitTicketStatusChanged(String(ticket._id), ticket.status);
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function addWatcher(ticketId, watcherUserId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const watcher = await User.findById(watcherUserId).select("isActive").lean();
  if (!watcher || watcher.isActive === false) throw new ApiError(400, "Invalid watcher user");

  const wid = toOid(watcherUserId);
  const before = ticketSnapshot(ticket);
  if (!ticket.watchers.some((w) => w.equals(wid))) ticket.watchers.push(wid);

  await ticket.save();
  await auditTicket(req, ticket, "ticket.watcher_added", before, ticketSnapshot(ticket));

  const after = ticketSnapshot(ticket);
  socketSafe(() => {
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

/** @param {import("express").Request} req */
export async function removeWatcher(ticketId, watcherUserId, user, req) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  const wid = toOid(watcherUserId);
  const before = ticketSnapshot(ticket);
  ticket.watchers = (ticket.watchers || []).filter((w) => !w.equals(wid));

  await ticket.save();
  await auditTicket(req, ticket, "ticket.watcher_removed", before, ticketSnapshot(ticket));

  const after = ticketSnapshot(ticket);
  socketSafe(() => {
    ticketSocket.emitTicketUpdated(String(ticket._id), diffSnapshots(before, after));
  });

  return ticket;
}

export async function getTicketHistory(ticketId, user) {
  const ticket = await Ticket.findById(ticketId);
  assertTicketVisible(ticket, user);

  return AuditLog.find({ targetModel: "Ticket", targetId: toOid(ticketId) })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

/** @param {import("express").Request} req */
export async function deleteTicket(ticketId, user, req) {
  if (user.role !== "admin") throw new ApiError(403, "Only admins can delete tickets");

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");

  const before = ticketSnapshot(ticket);

  socketSafe(() => {
    ticketSocket.emitTicketUpdated(String(ticketId), { deleted: { from: false, to: true } });
  });

  await Message.deleteMany({ ticketId: ticket._id });
  await Ticket.deleteOne({ _id: ticket._id });

  await auditLogService.log({
    action: "ticket.deleted",
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
