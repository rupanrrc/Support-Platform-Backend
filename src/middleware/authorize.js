import { ApiError } from "../utils/ApiError.js";

/**
 * RBAC middleware factory. Compares `req.user.role` against allowed roles.
 * @param  {...string} roles
 * @returns {import("express").RequestHandler}
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }

    next();
  };
}
