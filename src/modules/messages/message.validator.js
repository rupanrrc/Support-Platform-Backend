import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const messageAttachmentSchema = z
  .object({
    filename: z.string().min(1).max(255),
    url: z.string().min(1).max(2048),
    mimetype: z.string().min(1).max(120),
    size: z.number().int().positive().max(10 * 1024 * 1024)
  })
;

export const createMessageSchema = z
  .object({
    ticketId: objectId,
    content: z.string().min(1).max(50000),
    isInternal: z.boolean().optional(),
    attachments: z.array(messageAttachmentSchema).max(10).optional()
  })
;

export const patchMessageSchema = z
  .object({
    ticketId: objectId,
    messageId: objectId,
    content: z.string().min(1).max(50000)
  })
;

export const markMessagesReadSchema = z
  .object({
    ticketId: objectId
  })
;

export const messageDeleteParamSchema = z
  .object({
    ticketId: objectId,
    messageId: objectId
  })
;
