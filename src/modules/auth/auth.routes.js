import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { authLimiter } from "../../middleware/rateLimiter.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { User } from "../users/user.model.js";
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

/**
 * First bootstrap registration is open; afterwards only admins may create users.
 */
const requireAdminUnlessBootstrap = asyncHandler(async (req, res, next) => {
  const count = await User.countDocuments();
  if (count === 0) {
    return next();
  }

  await new Promise((resolve, reject) => {
    authenticate(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });

  authorize("admin")(req, res, next);
});

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  requireAdminUnlessBootstrap,
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
