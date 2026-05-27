import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./team.controller.js";
import {
  addMemberSchema,
  createTeamSchema,
  teamIdParamSchema,
  teamMemberParamSchema,
  teamQueueQuerySchema,
  updateTeamSchema
} from "./team.validator.js";

const router = Router();

router.get("/", authenticate, controller.list);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createTeamSchema),
  controller.create
);

router.get("/:id/queue", authenticate, validate(teamQueueQuerySchema), controller.queue);

router.get("/:id/stats", authenticate, validate(teamIdParamSchema), controller.stats);

router.get("/:id", authenticate, validate(teamIdParamSchema), controller.getById);

router.patch(
  "/:id",
  authenticate,
  authorize("admin", "manager"),
  validate(updateTeamSchema),
  controller.update
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(teamIdParamSchema),
  controller.remove
);

router.post(
  "/:id/members",
  authenticate,
  authorize("admin", "manager"),
  validate(addMemberSchema),
  controller.addMember
);

router.delete(
  "/:id/members/:uid",
  authenticate,
  authorize("admin", "manager"),
  validate(teamMemberParamSchema),
  controller.removeMember
);

export default router;
