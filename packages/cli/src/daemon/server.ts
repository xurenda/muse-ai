import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import {
  CLI_API_PATHS,
  createHealthResponse,
  healthResponseSchema,
} from "@muse-ai/shared";
import type { CliConfig } from "../config.js";

export function createCliApp(config: CliConfig): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: config.corsOrigins,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.get(CLI_API_PATHS.HEALTH, (c) => {
    const body = createHealthResponse("cli", "0.0.0");
    healthResponseSchema.parse(body);
    return c.json(body);
  });

  // 阶段 1+：agents、sessions、chat SSE
  app.get(CLI_API_PATHS.AGENTS, (c) => c.json({ agents: [] }));
  app.get(CLI_API_PATHS.SESSIONS, (c) => c.json({ sessions: [] }));

  return app;
}

export function startCliServer(config: CliConfig): void {
  const app = createCliApp(config);

  serve({
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  });

  console.log(`muse cli daemon listening on http://${config.host}:${config.port}`);
}
