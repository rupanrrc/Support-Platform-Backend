import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { optionalAuthenticate } from "../../middleware/optionalAuthenticate.js";
import { authLimiter } from "../../middleware/rateLimiter.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema
} from "./auth.validator.js";

const router = Router();

router.get("/registration-status", authLimiter, controller.registrationStatus);

router.post(
  "/register",
  authLimiter,
  optionalAuthenticate,
  validate(registerSchema),
  controller.register
);

router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/logout", authLimiter, validate(logoutSchema), controller.logout);
router.post("/refresh", authLimiter, validate(refreshSchema), controller.refresh);
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  controller.forgotPassword
);
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  controller.resetPassword
);

router.get("/me", authenticate, controller.me);

export default router;
