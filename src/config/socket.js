import { Server } from "socket.io";
import { getEnv } from "./env.js";
import { registerSocketHandlers } from "../sockets/socketManager.js";

/** @type {import("socket.io").Server | null} */
let io = null;

/**
 * Attaches Socket.IO to the HTTP server with CORS aligned to the REST API.
 * @param {import("http").Server} httpServer
 */
export function attachSocketIO(httpServer) {
  const { CORS_ORIGIN, NODE_ENV } = getEnv();

  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    connectionStateRecovery: NODE_ENV === "production"
  });

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO engine connection error:", err.message);
  });

  registerSocketHandlers(io);

  return io;
}

/** @returns {import("socket.io").Server} */
export function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized. Call attachSocketIO first.");
  }
  return io;
}
