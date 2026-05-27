import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";

/**
 * Express middleware factory: validates merged body + query + params with a Zod schema.
 * @template {import("zod").ZodTypeAny} T
 * @param {T} schema
 * @returns {import("express").RequestHandler}
 */
export function validate(schema) {
  return (req, _res, next) => {
    try {
      const merged = {
        ...req.body,
        ...req.query,
        ...req.params
      };
      req.validated = schema.parse(merged);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ApiError(400, "Validation failed", err.flatten().fieldErrors)
        );
      }
      next(err);
    }
  };
}
