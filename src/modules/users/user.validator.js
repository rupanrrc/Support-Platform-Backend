import { z } from "zod";
import { passwordSchema } from "../auth/auth.validator.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");
const roleEnum = z.enum(["customer", "agent", "manager", "admin"]);

export const createUserSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: passwordSchema,
    role: roleEnum,
    teamId: objectId.optional().nullable(),
    avatar: z.string().max(2048).optional()
  })
  .superRefine((val, ctx) => {
    if ((val.role === "agent" || val.role === "manager") && !val.teamId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "teamId is required for agent and manager roles",
        path: ["teamId"]
      });
    }
    if (val.teamId && val.role !== "agent" && val.role !== "manager") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "teamId is only allowed for agent or manager roles",
        path: ["teamId"]
      });
    }
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  role: roleEnum.optional(),
  teamId: objectId.optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true"))
});

export const userIdParamSchema = z.object({
  id: objectId
});

export const updateUserSchema = z.object({
  id: objectId,
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(254).optional(),
  avatar: z.string().max(2048).optional(),
  isActive: z.boolean().optional()
});

export const updateRoleSchema = z.object({
  id: objectId,
  role: roleEnum
});

export const assignTeamSchema = z.object({
  id: objectId,
  teamId: objectId.nullable()
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  avatar: z.string().max(2048).optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema
});
