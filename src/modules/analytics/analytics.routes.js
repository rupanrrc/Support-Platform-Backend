import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./analytics.controller.js";
import {
  dateRangeQuerySchema,
  resolutionTimeQuerySchema,
  slaQuerySchema
} from "./analytics.validator.js";

const router = Router();

const managerPlus = [authenticate, authorize("manager", "admin")];

router.get("/overview", ...managerPlus, controller.overview);

router.get(
  "/ticket-volume",
  ...managerPlus,
  validate(dateRangeQuerySchema),
  controller.ticketVolume
);

router.get(
  "/resolution-time",
  ...managerPlus,
  validate(resolutionTimeQuerySchema),
  controller.resolutionTime
);

router.get("/agent-performance", ...managerPlus, controller.agentPerformance);

router.get("/team-performance", ...managerPlus, controller.teamPerformance);

router.get("/sla", ...managerPlus, validate(slaQuerySchema), controller.sla);

router.get("/categories", ...managerPlus, controller.categories);

export default router;
