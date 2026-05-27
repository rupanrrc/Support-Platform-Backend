import { ApiError } from "../utils/ApiError.js";

/**
 * Central Express error handler. Maps ApiError and Mongoose errors to JSON responses.
 * @type {import("express").ErrorRequestHandler}
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  if (err && err.name === "ValidationError") {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ message: "Validation failed", details });
  }

  if (err && err.code === 11000) {
    return res.status(409).json({ message: "Duplicate key violation" });
  }

  if (err && err.name === "CastError") {
    return res.status(400).json({ message: "Invalid identifier" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal Server Error" });
}
