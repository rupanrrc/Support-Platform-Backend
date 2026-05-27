import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Verifies `Authorization: Bearer <accessToken>` and attaches a minimal user context.
 * Shape matches architecture: `req.user = { id, role, teamId }`.
 * @type {import("express").RequestHandler}
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  const { JWT_ACCESS_SECRET } = getEnv();

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    if (typeof payload !== "object" || payload === null) {
      throw new ApiError(401, "Invalid token");
    }

    const sub = payload.sub;
    const role = payload.role;
    const teamId = payload.teamId ?? null;

    if (typeof sub !== "string" || !sub) {
      throw new ApiError(401, "Invalid token subject");
    }
    if (typeof role !== "string" || !role) {
      throw new ApiError(401, "Invalid token role");
    }

    req.user = {
      id: sub,
      role,
      teamId: teamId && typeof teamId === "string" ? teamId : teamId ? String(teamId) : null
    };

    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, "Invalid or expired token");
  }
});
