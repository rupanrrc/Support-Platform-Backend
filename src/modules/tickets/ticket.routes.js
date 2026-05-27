import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./ticket.controller.js";
import {
  assignTicketSchema,
  createTicketSchema,
  escalateTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
  watcherBodySchema,
  watcherDeleteParamSchema
} from "./ticket.validator.js";
import messageRoutes from "../messages/message.routes.js";

const router = Router();

router.get("/", authenticate, validate(listTicketsQuerySchema), controller.list);

router.post(
  "/",
  authenticate,
  authorize("customer", "agent", "admin", "manager"),
  validate(createTicketSchema),
  controller.create
);

router.use("/:ticketId/messages", messageRoutes);

router.get("/:ticketId/history", authenticate, validate(ticketIdParamSchema), controller.history);

router.get("/:ticketId", authenticate, validate(ticketIdParamSchema), controller.getById);

router.patch(
  "/:ticketId",
  authenticate,
  validate(updateTicketSchema),
  controller.update
);

router.delete(
  "/:ticketId",
  authenticate,
  authorize("admin"),
  validate(ticketIdParamSchema),
  controller.remove
);

router.patch(
  "/:ticketId/assign",
  authenticate,
  authorize("agent", "manager", "admin"),
  validate(assignTicketSchema),
  controller.assign
);

router.patch(
  "/:ticketId/escalate",
  authenticate,
  authorize("agent", "manager", "admin"),
  validate(escalateTicketSchema),
  controller.escalate
);

router.patch(
  "/:ticketId/resolve",
  authenticate,
  authorize("agent", "manager", "admin"),
  validate(ticketIdParamSchema),
  controller.resolve
);

router.patch(
  "/:ticketId/reopen",
  authenticate,
  authorize("agent", "manager", "admin"),
  validate(ticketIdParamSchema),
  controller.reopen
);

router.patch(
  "/:ticketId/close",
  authenticate,
  authorize("agent", "manager", "admin"),
  validate(ticketIdParamSchema),
  controller.close
);

router.post(
  "/:ticketId/watchers",
  authenticate,
  validate(watcherBodySchema),
  controller.addWatcher
);

router.delete(
  "/:ticketId/watchers/:userId",
  authenticate,
  validate(watcherDeleteParamSchema),
  controller.removeWatcher
);

export default router;
