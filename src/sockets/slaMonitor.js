import { Ticket } from "../modules/tickets/ticket.model.js";
import { Team } from "../modules/teams/team.model.js";
import * as notificationService from "../modules/notifications/notification.service.js";

const INTERVAL_MS = 60 * 1000;

/**
 * Periodically flags breached SLAs and warns assignees when deadlines are within one hour.
 * @param {import("socket.io").Server} io
 */
export function startSlaMonitor(io) {
  if (!io) return;
  void io;

  setInterval(async () => {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 60 * 60 * 1000);

      await Ticket.updateMany(
        {
          slaBreached: false,
          slaDeadline: { $lt: now },
          status: { $nin: ["resolved", "closed"] }
        },
        { $set: { slaBreached: true } }
      );

      const nearing = await Ticket.find({
        slaBreached: false,
        slaWarningSent: false,
        slaDeadline: { $gt: now, $lte: soon },
        status: { $nin: ["resolved", "closed"] }
      })
        .select("_id ticketNumber title slaDeadline assignedAgentId assignedTeamId")
        .limit(200)
        .lean();

      for (const t of nearing) {
        await Ticket.updateOne({ _id: t._id }, { $set: { slaWarningSent: true } });

        const title = "SLA deadline approaching";
        const body = `Ticket ${t.ticketNumber} is due before ${t.slaDeadline?.toISOString?.() || "its SLA deadline"}.`;

        if (t.assignedAgentId) {
          await notificationService.createNotification({
            userId: String(t.assignedAgentId),
            type: "sla_breach_warning",
            title,
            body,
            ticketId: String(t._id)
          });
        }

        if (t.assignedTeamId) {
          const team = await Team.findById(t.assignedTeamId).select("managerId").lean();
          if (team?.managerId) {
            await notificationService.createNotification({
              userId: String(team.managerId),
              type: "sla_breach_warning",
              title,
              body,
              ticketId: String(t._id)
            });
          }
        }
      }
    } catch (err) {
      console.error("SLA monitor error:", err);
    }
  }, INTERVAL_MS);
}
