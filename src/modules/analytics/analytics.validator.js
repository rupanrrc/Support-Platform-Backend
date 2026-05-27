import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).optional().default("day")
});

export const resolutionTimeQuerySchema = z.object({
  teamId: objectId.optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const slaQuerySchema = z.object({
  teamId: objectId.optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});
