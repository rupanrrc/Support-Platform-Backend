import { asyncHandler } from "../../utils/asyncHandler.js";
import * as messageService from "./message.service.js";

export const list = asyncHandler(async (req, res) => {
  const messages = await messageService.getThread(req.params.ticketId, req.user);
  res.json({ messages });
});

export const create = asyncHandler(async (req, res) => {
  const message = await messageService.createMessage(
    req.params.ticketId,
    req.validated,
    req.user,
    req
  );
  res.status(201).json({ message });
});

export const markRead = asyncHandler(async (req, res) => {
  const result = await messageService.markAsRead(req.params.ticketId, req.user, req);
  res.json(result);
});

export const update = asyncHandler(async (req, res) => {
  const { ticketId, messageId, content } = req.validated;
  const message = await messageService.updateMessage(ticketId, messageId, content, req.user, req);
  res.json({ message });
});

export const remove = asyncHandler(async (req, res) => {
  const { ticketId, messageId } = req.validated;
  await messageService.deleteMessage(ticketId, messageId, req.user, req);
  res.status(204).send();
});
