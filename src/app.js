import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalApiLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import authRoutes from "./modules/auth/auth.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import teamRoutes from "./modules/teams/team.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import auditLogRoutes from "./modules/auditlogs/auditlog.routes.js";

const env = getEnv();

export const app = express();

app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(globalApiLimiter);
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auditlogs", auditLogRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.use(errorHandler);
