import { asyncHandler } from "../../utils/asyncHandler.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated, req.user);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated);
  res.json(result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.validated);
  res.status(204).send();
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.validated);
  res.json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.validated);
  res.json(result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.validated);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const result = await authService.getProfile(req.user.id);
  res.json(result);
});
