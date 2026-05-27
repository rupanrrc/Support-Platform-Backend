import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./user.controller.js";
import {
  assignTeamSchema,
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateRoleSchema,
  updateUserSchema,
  userIdParamSchema
} from "./user.validator.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager"),
  validate(listUsersQuerySchema),
  controller.list
);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createUserSchema),
  controller.create
);

router.patch("/me/profile", authenticate, validate(updateProfileSchema), controller.patchProfile);

router.patch(
  "/me/password",
  authenticate,
  validate(changePasswordSchema),
  controller.patchPassword
);

router.get("/:id", authenticate, validate(userIdParamSchema), controller.getById);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(updateUserSchema),
  controller.update
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(userIdParamSchema),
  controller.remove
);

router.patch(
  "/:id/role",
  authenticate,
  authorize("admin"),
  validate(updateRoleSchema),
  controller.patchRole
);

router.patch(
  "/:id/team",
  authenticate,
  authorize("admin", "manager"),
  validate(assignTeamSchema),
  controller.patchTeam
);

export default router;
