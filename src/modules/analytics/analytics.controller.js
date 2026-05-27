import { asyncHandler } from "../../utils/asyncHandler.js";
import * as analyticsService from "./analytics.service.js";

export const overview = asyncHandler(async (_req, res) => {
  res.json(await analyticsService.getOverview());
});

export const ticketVolume = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTicketVolumeByDay(req.validated);
  res.json({ data });
});

export const resolutionTime = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAvgResolutionTime(req.validated);
  res.json({ data });
});

export const agentPerformance = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getAgentLeaderboard();
  res.json({ data });
});

export const teamPerformance = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getTeamPerformance();
  res.json({ data });
});

export const sla = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSLAReport(req.validated);
  res.json({ data });
});

export const categories = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getCategoriesReport();
  res.json({ data });
});
