import { asyncHandler } from "../../utils/asyncHandler.js";
import * as teamService from "./team.service.js";

export const list = asyncHandler(async (req, res) => {
  const teams = await teamService.listTeams(req.user);
  res.json({ teams });
});

export const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.validated, req);
  res.status(201).json({ team });
});

export const getById = asyncHandler(async (req, res) => {
  const team = await teamService.getTeamById(req.validated.id);
  res.json({ team });
});

export const update = asyncHandler(async (req, res) => {
  const { id, ...rest } = req.validated;
  const team = await teamService.updateTeam(id, rest, req);
  res.json({ team });
});

export const remove = asyncHandler(async (req, res) => {
  const team = await teamService.deactivateTeam(req.validated.id, req);
  res.json({ team });
});

export const addMember = asyncHandler(async (req, res) => {
  const { id, userId } = req.validated;
  const team = await teamService.addMember(id, userId, req);
  res.json({ team });
});

export const removeMember = asyncHandler(async (req, res) => {
  const { id, uid } = req.validated;
  const team = await teamService.removeMember(id, uid, req);
  res.json({ team });
});

export const queue = asyncHandler(async (req, res) => {
  const { id, status } = req.validated;
  const tickets = await teamService.getTeamQueue(id, status);
  res.json({ tickets });
});

export const stats = asyncHandler(async (req, res) => {
  const result = await teamService.getTeamStats(req.validated.id);
  res.json(result);
});
