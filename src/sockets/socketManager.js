import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { User } from "../modules/users/user.model.js";

/**
 * @param {unknown} ticketId
 * @returns {string | null}
 */
function normalizeTicketId(ticketId) {
  if (!ticketId || typeof ticketId !== "string") return null;
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return null;
  return ticketId;
}

/**
 * Registers JWT auth middleware and connection/event handlers for Socket.IO.
 * @param {import("socket.io").Server} io
 */
export function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token || typeof token !== "string") {
        return next(new Error("Unauthorized"));
      }

      const { JWT_ACCESS_SECRET } = getEnv();
      const payload = jwt.verify(token, JWT_ACCESS_SECRET);
      if (typeof payload !== "object" || payload === null) {
        return next(new Error("Unauthorized"));
      }

      const sub = payload.sub;
      const role = payload.role;
      const teamId = payload.teamId ?? null;

      if (typeof sub !== "string" || !sub) {
        return next(new Error("Unauthorized"));
      }
      if (typeof role !== "string" || !role) {
        return next(new Error("Unauthorized"));
      }

      socket.user = {
        id: sub,
        role,
        teamId: teamId && typeof teamId === "string" ? teamId : teamId ? String(teamId) : null
      };

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const u = socket.user;

    const profile = await User.findById(u.id).select("name").lean();
    socket.data.displayName = profile?.name || "User";

    socket.join(`user:${u.id}`);
    if (u.teamId) {
      socket.join(`team:${u.teamId}`);
    }
    if (u.role === "admin") {
      socket.join("role:admin");
    }
    if (u.role === "manager") {
      socket.join("role:manager");
    }

    if (u.teamId && (u.role === "agent" || u.role === "manager")) {
      socket.to(`team:${u.teamId}`).emit("agent:online-status", {
        userId: u.id,
        online: true
      });
    }

    socket.on("ticket:join", (payload) => {
      const ticketId = normalizeTicketId(payload?.ticketId);
      if (!ticketId) return;
      socket.join(`ticket:${ticketId}`);
    });

    socket.on("ticket:leave", (payload) => {
      const ticketId = normalizeTicketId(payload?.ticketId);
      if (!ticketId) return;
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on("message:typing", (payload) => {
      const ticketId = normalizeTicketId(payload?.ticketId);
      if (!ticketId) return;
      socket.to(`ticket:${ticketId}`).emit("message:typing", {
        ticketId,
        user: { id: u.id, name: socket.data.displayName }
      });
    });

    socket.on("message:stop-typing", (payload) => {
      const ticketId = normalizeTicketId(payload?.ticketId);
      if (!ticketId) return;
      socket.to(`ticket:${ticketId}`).emit("message:stop-typing", {
        ticketId,
        userId: u.id
      });
    });

    socket.on("ticket:view", (payload) => {
      const ticketId = normalizeTicketId(payload?.ticketId);
      if (!ticketId) return;
      socket.to(`ticket:${ticketId}`).emit("ticket:view", {
        ticketId,
        userId: u.id
      });
    });

    socket.on("disconnect", () => {
      if (u.teamId && (u.role === "agent" || u.role === "manager")) {
        socket.to(`team:${u.teamId}`).emit("agent:online-status", {
          userId: u.id,
          online: false
        });
      }
    });
  });
}
