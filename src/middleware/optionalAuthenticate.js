import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

/**
 * Attaches `req.user` when a valid Bearer token is present; otherwise continues without error.
 * @type {import("express").RequestHandler}
 */
export function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return next();
  }

  const { JWT_ACCESS_SECRET } = getEnv();

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    if (typeof payload !== "object" || payload === null) {
      return next();
    }

    const sub = payload.sub;
    const role = payload.role;
    const teamId = payload.teamId ?? null;

    if (typeof sub === "string" && sub && typeof role === "string" && role) {
      req.user = {
        id: sub,
        role,
        teamId: teamId && typeof teamId === "string" ? teamId : teamId ? String(teamId) : null
      };
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}
