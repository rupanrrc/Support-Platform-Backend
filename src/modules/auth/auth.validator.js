import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    "Password must include uppercase, lowercase, number, and special character"
  );

const roleEnum = z.enum(["customer", "agent", "manager", "admin"]);

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

export const registerSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: passwordSchema,
    role: roleEnum.optional(),
    teamId: objectIdString.optional().nullable()
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

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096)
});

export const logoutSchema = refreshSchema;

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(254)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema
});
