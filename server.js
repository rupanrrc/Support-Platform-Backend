import { createServer } from "http";
import { app } from "./src/app.js";
import { connectDatabase } from "./src/config/db.js";
import { getEnv } from "./src/config/env.js";
import { attachSocketIO } from "./src/config/socket.js";
import { startSlaMonitor } from "./src/sockets/slaMonitor.js";

async function bootstrap() {
  await connectDatabase();

  const httpServer = createServer(app);
  const io = attachSocketIO(httpServer);
  startSlaMonitor(io);

  const env = getEnv();
  httpServer.listen(env.PORT, env.HOST, () => {
    console.log(`HTTP server listening on http://${env.HOST}:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
