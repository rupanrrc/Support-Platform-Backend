import { asyncHandler } from "../../utils/asyncHandler.js";
import * as ticketService from "./ticket.service.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, status, priority, teamId, from, to } = req.validated;
  const result = await ticketService.listTickets(
    { status, priority, teamId, from, to },
    { page, limit },
    req.user
  );
  res.json(result);
});

export const create = asyncHandler(async (req, res) => {
  const ticket = await ticketService.createTicket(req.validated, req.user, req);
  res.status(201).json({ ticket });
});

export const getById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getTicketById(req.validated.ticketId, req.user);
  res.json({ ticket });
});

export const update = asyncHandler(async (req, res) => {
  const { ticketId, ...rest } = req.validated;
  const ticket = await ticketService.updateTicket(ticketId, rest, req.user, req);
  res.json({ ticket });
});

export const remove = asyncHandler(async (req, res) => {
  await ticketService.deleteTicket(req.validated.ticketId, req.user, req);
  res.status(204).send();
});

export const assign = asyncHandler(async (req, res) => {
  const { ticketId, agentId, teamId } = req.validated;
  const ticket = await ticketService.assignToAgent(ticketId, agentId, teamId, req.user, req);
  res.json({ ticket });
});

export const escalate = asyncHandler(async (req, res) => {
  const { ticketId, targetTeamId, reason } = req.validated;
  const ticket = await ticketService.escalateTicket(ticketId, targetTeamId, reason, req.user, req);
  res.json({ ticket });
});

export const resolve = asyncHandler(async (req, res) => {
  const ticket = await ticketService.resolveTicket(req.validated.ticketId, req.user, req);
  res.json({ ticket });
});

export const reopen = asyncHandler(async (req, res) => {
  const ticket = await ticketService.reopenTicket(req.validated.ticketId, req.user, req);
  res.json({ ticket });
});

export const close = asyncHandler(async (req, res) => {
  const ticket = await ticketService.closeTicket(req.validated.ticketId, req.user, req);
  res.json({ ticket });
});

export const addWatcher = asyncHandler(async (req, res) => {
  const { ticketId, userId } = req.validated;
  const ticket = await ticketService.addWatcher(ticketId, userId, req.user, req);
  res.json({ ticket });
});

export const removeWatcher = asyncHandler(async (req, res) => {
  const { ticketId, userId } = req.validated;
  const ticket = await ticketService.removeWatcher(ticketId, userId, req.user, req);
  res.json({ ticket });
});

export const history = asyncHandler(async (req, res) => {
  const logs = await ticketService.getTicketHistory(req.validated.ticketId, req.user);
  res.json({ logs });
});
