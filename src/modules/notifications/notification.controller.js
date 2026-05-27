import { asyncHandler } from "../../utils/asyncHandler.js";
import * as notificationService from "./notification.service.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, isRead } = req.validated;
  const result = await notificationService.listForUser(req.user.id, { page, limit, isRead });
  res.json(result);
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.validated.id, req.user.id);
  res.json({ notification });
});

export const markAllRead = asyncHandler(async (_req, res) => {
  const result = await notificationService.markAllAsRead(_req.user.id);
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.validated.id, req.user.id);
  res.status(204).send();
});
