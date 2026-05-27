import mongoose from "mongoose";
import { Team } from "./team.model.js";
import { User } from "../users/user.model.js";
import { Ticket } from "../tickets/ticket.model.js";
import * as auditLogService from "../auditlogs/auditlog.service.js";
import { ApiError } from "../../utils/ApiError.js";

/** @param {string | null | undefined} id */
function toOid(id) {
  if (!id) return null;
  return new mongoose.Types.ObjectId(id);
}

/** @param {import("mongoose").Document} team */
function teamSnapshot(team) {
  return {
    name: team.name,
    slug: team.slug,
    description: team.description,
    managerId: team.managerId ? String(team.managerId) : null,
    isActive: team.isActive,
    memberCount: (team.members || []).length
  };
}

export async function listTeams(requester) {
  /** @type {Record<string, unknown>} */
  const query = { isActive: true };

  if (requester.role === "manager" || requester.role === "agent") {
    if (!requester.teamId) return [];
    query._id = toOid(requester.teamId);
  }

  return Team.find(query)
    .sort({ name: 1 })
    .populate("managerId", "name email role")
    .populate("members", "name email role");
}

export async function getTeamById(teamId) {
  const team = await Team.findById(teamId)
    .populate("managerId", "name email role avatar")
    .populate("members", "name email role avatar isActive");

  if (!team) throw new ApiError(404, "Team not found");
  return team;
}

/**
 * @param {import("express").Request} req
 */
export async function createTeam(input, req) {
  const existing = await Team.findOne({ name: input.name.trim() }).select("_id").lean();
  if (existing) throw new ApiError(409, "Team name already exists");

  if (input.managerId) {
    const manager = await User.findById(input.managerId).select("role isActive").lean();
    if (!manager || !manager.isActive || manager.role !== "manager") {
      throw new ApiError(400, "managerId must reference an active manager user");
    }
  }

  const team = await Team.create({
    name: input.name.trim(),
    description: input.description || "",
    managerId: input.managerId ? toOid(input.managerId) : null,
    members: [],
    isActive: true
  });

  await auditLogService.log({
    action: "team.created",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(team._id),
    targetModel: "Team",
    before: null,
    after: teamSnapshot(team),
    req
  });

  return team;
}

/**
 * @param {import("express").Request} req
 */
export async function updateTeam(teamId, input, req) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");

  if (req.user?.role === "manager" && String(team._id) !== req.user.teamId) {
    throw new ApiError(403, "Managers can only update their own team");
  }

  const before = teamSnapshot(team);

  if (input.name !== undefined) {
    const dup = await Team.findOne({ name: input.name.trim(), _id: { $ne: team._id } })
      .select("_id")
      .lean();
    if (dup) throw new ApiError(409, "Team name already exists");
    team.name = input.name.trim();
    team.slug = "";
  }

  if (input.description !== undefined) team.description = input.description;
  if (input.isActive !== undefined) team.isActive = input.isActive;

  if (input.managerId !== undefined) {
    if (input.managerId) {
      const manager = await User.findById(input.managerId).select("role isActive").lean();
      if (!manager || !manager.isActive || manager.role !== "manager") {
        throw new ApiError(400, "managerId must reference an active manager user");
      }
      team.managerId = toOid(input.managerId);
    } else {
      team.managerId = null;
    }
  }

  await team.save();

  await auditLogService.log({
    action: "team.updated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(team._id),
    targetModel: "Team",
    before,
    after: teamSnapshot(team),
    req
  });

  return team;
}

/**
 * @param {import("express").Request} req
 */
export async function deactivateTeam(teamId, req) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");

  const before = teamSnapshot(team);
  team.isActive = false;
  await team.save();

  await auditLogService.log({
    action: "team.deactivated",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(team._id),
    targetModel: "Team",
    before,
    after: teamSnapshot(team),
    req
  });

  return team;
}

/**
 * @param {import("express").Request} req
 */
export async function addMember(teamId, userId, req) {
  const team = await Team.findById(teamId);
  if (!team || !team.isActive) throw new ApiError(404, "Team not found");

  if (req.user?.role === "manager" && String(team._id) !== req.user.teamId) {
    throw new ApiError(403, "Managers can only modify their own team");
  }

  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new ApiError(400, "Invalid user");

  if (user.role !== "agent" && user.role !== "manager") {
    throw new ApiError(400, "Only agents and managers can join a team");
  }

  const before = teamSnapshot(team);
  const uid = toOid(userId);

  if (!team.members.some((m) => m.equals(uid))) {
    team.members.push(uid);
    await team.save();
  }

  user.teamId = toOid(teamId);
  await user.save();

  await auditLogService.log({
    action: "team.member_added",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(team._id),
    targetModel: "Team",
    before,
    after: { ...teamSnapshot(team), addedUserId: userId },
    req
  });

  return team;
}

/**
 * @param {import("express").Request} req
 */
export async function removeMember(teamId, userId, req) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");

  if (req.user?.role === "manager" && String(team._id) !== req.user.teamId) {
    throw new ApiError(403, "Managers can only modify their own team");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const before = teamSnapshot(team);
  const uid = toOid(userId);

  team.members = team.members.filter((m) => !m.equals(uid));
  await team.save();

  if (user.teamId && user.teamId.equals(toOid(teamId))) {
    user.teamId = null;
    await user.save();
  }

  await auditLogService.log({
    action: "team.member_removed",
    actorId: req.user?.id,
    actorRole: req.user?.role || "",
    targetId: String(team._id),
    targetModel: "Team",
    before,
    after: { ...teamSnapshot(team), removedUserId: userId },
    req
  });

  return team;
}

export async function getTeamQueue(teamId, statusFilter) {
  const team = await Team.findById(teamId).select("_id isActive").lean();
  if (!team || !team.isActive) throw new ApiError(404, "Team not found");

  /** @type {Record<string, unknown>} */
  const query = {
    $or: [{ assignedTeamId: toOid(teamId) }, { escalatedToTeamId: toOid(teamId) }]
  };

  if (statusFilter) {
    query.status = statusFilter;
  } else {
    query.status = { $in: ["open", "in_progress", "pending", "escalated"] };
  }

  return Ticket.find(query)
    .sort({ priority: -1, createdAt: 1 })
    .populate("customerId", "name email")
    .populate("assignedAgentId", "name email")
    .lean();
}

export async function getTeamStats(teamId) {
  const team = await Team.findById(teamId).select("_id name").lean();
  if (!team) throw new ApiError(404, "Team not found");

  const tid = toOid(teamId);

  const [openCount, resolvedCount, escalatedCount, avgResolution] = await Promise.all([
    Ticket.countDocuments({
      assignedTeamId: tid,
      status: { $in: ["open", "in_progress", "pending"] }
    }),
    Ticket.countDocuments({ assignedTeamId: tid, status: "resolved" }),
    Ticket.countDocuments({ escalatedToTeamId: tid, status: "escalated" }),
    Ticket.aggregate([
      {
        $match: {
          assignedTeamId: tid,
          status: "resolved",
          resolvedAt: { $ne: null },
          createdAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] }
        }
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: "$resolutionMs" }
        }
      }
    ])
  ]);

  const avgResolutionHours =
    avgResolution[0]?.avgMs != null
      ? Math.round((avgResolution[0].avgMs / (1000 * 60 * 60)) * 10) / 10
      : null;

  return {
    teamId: String(team._id),
    teamName: team.name,
    openTickets: openCount,
    resolvedTickets: resolvedCount,
    escalatedQueue: escalatedCount,
    avgResolutionHours
  };
}
