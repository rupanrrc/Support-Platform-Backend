import mongoose from "mongoose";
import { AuditLog } from "./auditlog.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination } from "../../utils/pagination.js";

/**
 * Persists an append-only audit record (internal service API).
 * @param {{
 *   action: string;
 *   actorId?: string | null;
 *   actorRole?: string | null;
 *   targetId: string;
 *   targetModel: "Ticket" | "User" | "Team";
 *   before?: unknown;
 *   after?: unknown;
 *   req?: import("express").Request;
 * }} params
 */
export async function log(params) {
  const ipAddress =
    params.req?.ip ||
    params.req?.socket?.remoteAddress ||
    "";
  const userAgent = String(params.req?.get?.("user-agent") || "").slice(0, 512);

  await AuditLog.create({
    action: params.action,
    actorId: params.actorId ? new mongoose.Types.ObjectId(params.actorId) : null,
    actorRole: params.actorRole || "",
    targetId: new mongoose.Types.ObjectId(params.targetId),
    targetModel: params.targetModel,
    before: params.before ?? null,
    after: params.after ?? null,
    ipAddress,
    userAgent
  });
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ page?: number; limit?: number }} pagination
 */
export async function listAuditLogs(filters, pagination) {
  const { page, limit, skip } = getPagination(pagination.page ?? 1, pagination.limit ?? 20);

  /** @type {Record<string, unknown>} */
  const query = {};

  if (filters.actorId) query.actorId = new mongoose.Types.ObjectId(String(filters.actorId));
  if (filters.targetId) query.targetId = new mongoose.Types.ObjectId(String(filters.targetId));
  if (filters.targetModel) query.targetModel = filters.targetModel;
  if (filters.action) query.action = new RegExp(String(filters.action), "i");

  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) /** @type {any} */ (query.createdAt).$gte = filters.from;
    if (filters.to) /** @type {any} */ (query.createdAt).$lte = filters.to;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actorId", "name email role")
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  return { items, total, page, limit };
}

export async function getAuditLogById(logId) {
  const entry = await AuditLog.findById(logId).populate("actorId", "name email role").lean();
  if (!entry) throw new ApiError(404, "Audit log not found");
  return entry;
}
