import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auditlog.controller.js";
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from "./auditlog.validator.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin"),
  validate(listAuditLogsQuerySchema),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(auditLogIdParamSchema),
  controller.getById
);

export default router;
