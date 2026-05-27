import { asyncHandler } from "../../utils/asyncHandler.js";
import * as userService from "./user.service.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, role, teamId, isActive } = req.validated;
  const result = await userService.listUsers({ role, teamId, isActive }, { page, limit }, req.user);
  res.json(result);
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.validated, req);
  res.status(201).json({ user });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.validated.id, req.user);
  res.json({ user });
});

export const update = asyncHandler(async (req, res) => {
  const { id, ...rest } = req.validated;
  const user = await userService.updateUser(id, rest, req);
  res.json({ user });
});

export const remove = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.validated.id, req);
  res.json({ user });
});

export const patchRole = asyncHandler(async (req, res) => {
  const { id, role } = req.validated;
  const user = await userService.updateRole(id, role, req);
  res.json({ user });
});

export const patchTeam = asyncHandler(async (req, res) => {
  const { id, teamId } = req.validated;
  const user = await userService.assignToTeam(id, teamId, req);
  res.json({ user });
});

export const patchProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.validated, req);
  res.json({ user });
});

export const patchPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  const result = await userService.changePassword(
    req.user.id,
    currentPassword,
    newPassword,
    req
  );
  res.json(result);
});
