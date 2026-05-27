import mongoose from "mongoose";
import { Ticket } from "../tickets/ticket.model.js";
import { Team } from "../teams/team.model.js";

/** @param {Date | undefined} from @param {Date | undefined} to */
function createdAtRange(from, to) {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return { createdAt: range };
}

export async function getOverview() {
  const [open, inProgress, pending, escalated, resolved, closed, slaBreached] = await Promise.all([
    Ticket.countDocuments({ status: "open" }),
    Ticket.countDocuments({ status: "in_progress" }),
    Ticket.countDocuments({ status: "pending" }),
    Ticket.countDocuments({ status: "escalated" }),
    Ticket.countDocuments({ status: "resolved" }),
    Ticket.countDocuments({ status: "closed" }),
    Ticket.countDocuments({ slaBreached: true, status: { $nin: ["resolved", "closed"] } })
  ]);

  return {
    open,
    inProgress,
    pending,
    escalated,
    resolved,
    closed,
    slaBreached,
    totalActive: open + inProgress + pending + escalated
  };
}

/**
 * @param {{ from?: Date; to?: Date; groupBy?: "day" | "week" | "month" }} params
 */
export async function getTicketVolumeByDay(params) {
  const match = createdAtRange(params.from, params.to);
  const groupBy = params.groupBy || "day";

  let dateFormat;
  if (groupBy === "week") {
    dateFormat = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
  } else if (groupBy === "month") {
    dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
  } else {
    dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  }

  const rows = await Ticket.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: dateFormat, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: "$_id", count: 1 } }
  ]);

  return rows;
}

/**
 * @param {{ teamId?: string; priority?: string; from?: Date; to?: Date }} params
 */
export async function getAvgResolutionTime(params) {
  /** @type {Record<string, unknown>} */
  const match = {
    status: "resolved",
    resolvedAt: { $ne: null },
    ...createdAtRange(params.from, params.to)
  };

  if (params.teamId) {
    match.assignedTeamId = new mongoose.Types.ObjectId(params.teamId);
  }
  if (params.priority) {
    match.priority = params.priority;
  }

  const rows = await Ticket.aggregate([
    { $match: match },
    {
      $project: {
        teamId: "$assignedTeamId",
        priority: 1,
        resolutionMs: { $subtract: ["$resolvedAt", "$createdAt"] }
      }
    },
    {
      $group: {
        _id: { teamId: "$teamId", priority: "$priority" },
        avgMs: { $avg: "$resolutionMs" },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        teamId: "$_id.teamId",
        priority: "$_id.priority",
        count: 1,
        avgResolutionHours: {
          $round: [{ $divide: ["$avgMs", 1000 * 60 * 60] }, 2]
        }
      }
    },
    { $sort: { teamId: 1, priority: 1 } }
  ]);

  return rows;
}

export async function getAgentLeaderboard() {
  const rows = await Ticket.aggregate([
    {
      $match: {
        status: "resolved",
        assignedAgentId: { $ne: null },
        resolvedAt: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$assignedAgentId",
        ticketsResolved: { $sum: 1 },
        avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent"
      }
    },
    { $unwind: "$agent" },
    {
      $project: {
        _id: 0,
        agentId: "$_id",
        name: "$agent.name",
        email: "$agent.email",
        ticketsResolved: 1,
        avgResolutionHours: {
          $round: [{ $divide: ["$avgMs", 1000 * 60 * 60] }, 2]
        },
        csat: { $literal: null }
      }
    },
    { $sort: { ticketsResolved: -1 } },
    { $limit: 50 }
  ]);

  return rows;
}

export async function getTeamPerformance() {
  const teams = await Team.find({ isActive: true }).select("_id name").lean();
  const results = [];

  for (const team of teams) {
    const tid = team._id;
    const [openTickets, resolvedTickets, escalated, avgRow] = await Promise.all([
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
            resolvedAt: { $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } }
          }
        }
      ])
    ]);

    results.push({
      teamId: String(tid),
      teamName: team.name,
      openTickets,
      resolvedTickets,
      escalatedQueue: escalated,
      avgResolutionHours:
        avgRow[0]?.avgMs != null
          ? Math.round((avgRow[0].avgMs / (1000 * 60 * 60)) * 10) / 10
          : null
    });
  }

  return results;
}

/**
 * @param {{ teamId?: string; priority?: string; from?: Date; to?: Date }} params
 */
export async function getSLAReport(params) {
  /** @type {Record<string, unknown>} */
  const match = {
    ...createdAtRange(params.from, params.to)
  };

  if (params.teamId) {
    match.assignedTeamId = new mongoose.Types.ObjectId(params.teamId);
  }
  if (params.priority) {
    match.priority = params.priority;
  }

  const rows = await Ticket.aggregate([
    { $match: match },
    {
      $group: {
        _id: { teamId: "$assignedTeamId", priority: "$priority" },
        total: { $sum: 1 },
        breached: {
          $sum: {
            $cond: [{ $eq: ["$slaBreached", true] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        teamId: "$_id.teamId",
        priority: "$_id.priority",
        total: 1,
        breached: 1,
        complianceRate: {
          $cond: [
            { $eq: ["$total", 0] },
            100,
            {
              $round: [
                {
                  $multiply: [
                    { $divide: [{ $subtract: ["$total", "$breached"] }, "$total"] },
                    100
                  ]
                },
                2
              ]
            }
          ]
        }
      }
    },
    { $sort: { teamId: 1, priority: 1 } }
  ]);

  return rows;
}

export async function getCategoriesReport() {
  const rows = await Ticket.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, category: "$_id", count: 1 } }
  ]);

  return rows;
}
