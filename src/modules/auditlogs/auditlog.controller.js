import { asyncHandler } from "../../utils/asyncHandler.js";
import * as auditLogService from "./auditlog.service.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, actorId, targetId, targetModel, action, from, to } = req.validated;
  const result = await auditLogService.listAuditLogs(
    { actorId, targetId, targetModel, action, from, to },
    { page, limit }
  );
  res.json(result);
});

export const getById = asyncHandler(async (req, res) => {
  const log = await auditLogService.getAuditLogById(req.validated.id);
  res.json({ log });
});
