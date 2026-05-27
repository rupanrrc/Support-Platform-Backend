import mongoose from "mongoose";
import { getEnv } from "./env.js";

let isConnected = false;

/**
 * Establishes a single Mongoose connection using MONGODB_URI.
 * Safe to call multiple times; reconnects only when disconnected.
 */
export async function connectDatabase() {
  if (isConnected) return;

  const { MONGODB_URI, NODE_ENV } = getEnv();

  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGODB_URI, {
    autoIndex: NODE_ENV !== "production"
  });

  await import("../models/registerModels.js");

  isConnected = true;

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  console.log("MongoDB connected");
}
