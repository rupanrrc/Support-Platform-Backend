import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  actorId: objectId.optional(),
  targetId: objectId.optional(),
  targetModel: z.enum(["Ticket", "User", "Team"]).optional(),
  action: z.string().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const auditLogIdParamSchema = z.object({
  id: objectId
});
