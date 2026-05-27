import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./notification.controller.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema
} from "./notification.validator.js";

const router = Router();

router.get("/", authenticate, validate(listNotificationsQuerySchema), controller.list);

router.patch("/read-all", authenticate, controller.markAllRead);

router.patch(
  "/:id/read",
  authenticate,
  validate(notificationIdParamSchema),
  controller.markRead
);

router.delete(
  "/:id",
  authenticate,
  validate(notificationIdParamSchema),
  controller.remove
);

export default router;
