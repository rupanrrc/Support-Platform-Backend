import mongoose from "mongoose";
import { User } from "./user.model.js";
import { Team } from "../teams/team.model.js";
import { hashPassword, verifyPassword } from "../auth/auth.service.js";
import * as auditLogService from "../auditlogs/auditlog.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination } from "../../utils/pagination.js";

/** @param {string | null | undefined} id */
function toOid(id) {
  if (!id) return null;
  return new mongoose.Types.ObjectId(id);
}

/** @param {import("mongoose").Document} user */
function userSnapshot(user) {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId ? String(user.teamId) : null,
    isActive: user.isActive,
    avatar: user.avatar
  };
}

async function assertTeamExists(teamId) {
  const team = await Team.findById(teamId).select("_id isActive").lean();
  if (!team || team.isActive === false) {
    throw new ApiError(400, "Team does not exist or is inactive");
  }
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ page?: number; limit?: number }} pagination
 * @param {{ id: string; role: string; teamId: string | null }} requester
 */
export async function listUsers(filters, pagination, requester) {
  if (requester.role !== "admin" && requester.role !== "manager") {
    throw new ApiError(403, "Insufficient permissions");
  }

  const { page, limit, skip } = getPagination(pagination.page ?? 1, pagination.limit ?? 20);
  /** @type {Record<string, unknown>} */
  const query = {};

  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;

  if (requester.role === "manager") {
    if (!requester.teamId) {
      return { items: [], total: 0, page, limit };
    }
    query.teamId = toOid(requester.teamId);
  } else if (filters.teamId) {
    query.teamId = toOid(String(filters.teamId));
  }

  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("teamId", "name slug"),
    User.countDocuments(query)
  ]);

  return { items, total, page, limit };
}

/**
 * @param {import("express").Request} req
 */
export async function createUser(input, req) {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) throw new ApiError(409, "Email is already registered");

  let teamId = input.teamId ?? null;
  if (input.role === "customer" || input.role === "admin") {
    teamId = null;
  } else if (!teamId) {
    throw new ApiError(400, "teamId is required for agent and manager roles");
  } else {
    await assertTeamExists(teamId);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role: input.role,
    teamId: teamId ? toOid(teamId) : null,
    avatar: input.avatar || "",
    isActive: true
  });

  if (teamId && (input.role === "agent" || input.role === "manager")) {
    await Team.updateOne({ _id: teamId }, { $addToSet: { members: user._id } });
  }

  await auditLogService.log({
    action: "user.created",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before: null,
    after: userSnapshot(user),
    req
  });

  return user;
}

export async function getUserById(userId, requester) {
  const user = await User.findById(userId).populate("teamId", "name slug");
  if (!user) throw new ApiError(404, "User not found");

  if (requester.role === "customer" && requester.id !== String(user._id)) {
    throw new ApiError(403, "Forbidden");
  }

  if (requester.role === "manager") {
    if (!requester.teamId || !user.teamId || String(user.teamId._id || user.teamId) !== requester.teamId) {
      throw new ApiError(403, "Forbidden");
    }
  }

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function updateUser(userId, input, req) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const before = userSnapshot(user);

  if (input.name !== undefined) user.name = input.name;
  if (input.avatar !== undefined) user.avatar = input.avatar;
  if (input.isActive !== undefined) user.isActive = input.isActive;

  if (input.email !== undefined) {
    const email = input.email.toLowerCase().trim();
    const dup = await User.findOne({ email, _id: { $ne: user._id } }).select("_id").lean();
    if (dup) throw new ApiError(409, "Email is already in use");
    user.email = email;
  }

  await user.save();

  await auditLogService.log({
    action: "user.updated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before,
    after: userSnapshot(user),
    req
  });

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function updateRole(userId, role, req) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const before = userSnapshot(user);
  user.role = role;

  if (role === "customer" || role === "admin") {
    if (user.teamId) {
      await Team.updateOne({ _id: user.teamId }, { $pull: { members: user._id } });
      user.teamId = null;
    }
  } else if (!user.teamId) {
    throw new ApiError(400, "Assign a team before setting agent or manager role");
  }

  await user.save();

  await auditLogService.log({
    action: "user.role_updated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before,
    after: userSnapshot(user),
    req
  });

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function assignToTeam(userId, teamId, req) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (req.user?.role === "manager") {
    if (!req.user.teamId) throw new ApiError(403, "Forbidden");
    if (teamId && String(teamId) !== req.user.teamId) {
      throw new ApiError(403, "Managers can only assign users to their own team");
    }
    if (user.teamId && String(user.teamId) !== req.user.teamId) {
      throw new ApiError(403, "Forbidden");
    }
  }

  if (user.role !== "agent" && user.role !== "manager") {
    throw new ApiError(400, "Only agents and managers can be assigned to a team");
  }

  const before = userSnapshot(user);

  if (user.teamId) {
    await Team.updateOne({ _id: user.teamId }, { $pull: { members: user._id } });
  }

  if (teamId) {
    await assertTeamExists(teamId);
    user.teamId = toOid(teamId);
    await Team.updateOne({ _id: teamId }, { $addToSet: { members: user._id } });
  } else {
    user.teamId = null;
  }

  await user.save();

  await auditLogService.log({
    action: "user.team_assigned",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before,
    after: userSnapshot(user),
    req
  });

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function deactivateUser(userId, req) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const before = userSnapshot(user);
  user.isActive = false;
  await user.save();

  await auditLogService.log({
    action: "user.deactivated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before,
    after: userSnapshot(user),
    req
  });

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function updateProfile(userId, input, req) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const before = userSnapshot(user);
  if (input.name !== undefined) user.name = input.name;
  if (input.avatar !== undefined) user.avatar = input.avatar;
  await user.save();

  await auditLogService.log({
    action: "user.profile_updated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before,
    after: userSnapshot(user),
    req
  });

  return user;
}

/**
 * @param {import("express").Request} req
 */
export async function changePassword(userId, currentPassword, newPassword, req) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new ApiError(404, "User not found");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(401, "Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await auditLogService.log({
    action: "user.password_changed",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(user._id),
    targetModel: "User",
    before: null,
    after: { changed: true },
    req
  });

  return { success: true };
}
