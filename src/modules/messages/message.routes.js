import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./message.controller.js";
import {
  createMessageSchema,
  markMessagesReadSchema,
  messageDeleteParamSchema,
  patchMessageSchema
} from "./message.validator.js";

const router = Router({ mergeParams: true });

router.post(
  "/read",
  authenticate,
  validate(markMessagesReadSchema),
  controller.markRead
);

router.get("/", authenticate, controller.list);

router.post("/", authenticate, validate(createMessageSchema), controller.create);

router.patch(
  "/:messageId",
  authenticate,
  validate(patchMessageSchema),
  controller.update
);

router.delete(
  "/:messageId",
  authenticate,
  authorize("admin"),
  validate(messageDeleteParamSchema),
  controller.remove
);

export default router;
