import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const statusEnum = z.enum([
  "open",
  "in_progress",
  "pending",
  "escalated",
  "resolved",
  "closed"
]);

const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

const attachmentSchema = z
  .object({
    filename: z.string().min(1).max(255),
    url: z.string().min(1).max(2048),
    mimetype: z.string().min(1).max(120),
    size: z.number().int().positive().max(25 * 1024 * 1024)
  })
;

export const createTicketSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(20000),
    priority: priorityEnum.optional(),
    category: z
      .string()
      .min(1)
      .max(64)
      .transform((s) => s.toLowerCase()),
    customerId: objectId.optional(),
    assignedTeamId: objectId.optional().nullable(),
    attachments: z.array(attachmentSchema).max(20).optional(),
    tags: z.array(z.string().min(1).max(64)).max(30).optional()
  })
;

export const updateTicketSchema = z
  .object({
    ticketId: objectId,
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(5).max(20000).optional(),
    priority: priorityEnum.optional(),
    category: z
      .string()
      .min(1)
      .max(64)
      .transform((s) => s.toLowerCase())
      .optional(),
    attachments: z.array(attachmentSchema).max(20).optional(),
    tags: z.array(z.string().min(1).max(64)).max(30).optional()
  })
;

export const listTicketsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    teamId: objectId.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
  })
;

export const assignTicketSchema = z
  .object({
    ticketId: objectId,
    agentId: objectId,
    teamId: objectId
  })
;

export const escalateTicketSchema = z
  .object({
    ticketId: objectId,
    targetTeamId: objectId,
    reason: z.string().min(3).max(2000)
  })
;

export const ticketIdParamSchema = z
  .object({
    ticketId: objectId
  })
;

export const watcherBodySchema = z
  .object({
    ticketId: objectId,
    userId: objectId
  })
;

export const watcherDeleteParamSchema = z
  .object({
    ticketId: objectId,
    userId: objectId
  })
;
