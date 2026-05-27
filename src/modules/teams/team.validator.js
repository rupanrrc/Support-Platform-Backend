import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

export const createTeamSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  managerId: objectId.optional().nullable()
});

export const updateTeamSchema = z.object({
  id: objectId,
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  managerId: objectId.optional().nullable(),
  isActive: z.boolean().optional()
});

export const teamIdParamSchema = z.object({
  id: objectId
});

export const teamMemberParamSchema = z.object({
  id: objectId,
  uid: objectId
});

export const addMemberSchema = z.object({
  id: objectId,
  userId: objectId
});

export const teamQueueQuerySchema = z.object({
  id: objectId,
  status: z
    .enum(["open", "in_progress", "pending", "escalated", "resolved", "closed"])
    .optional()
});
