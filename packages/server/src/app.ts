import { Hono } from "hono";
import {
  SERVER_API_PATHS,
  createHealthResponse,
  healthResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
} from "@muse-ai/shared";
import type { ServerConfig } from "./config.js";

export function createServerApp(_config: ServerConfig): Hono {
  const app = new Hono();

  app.get(SERVER_API_PATHS.HEALTH, (c) => {
    const body = createHealthResponse("server", "0.0.0");
    healthResponseSchema.parse(body);
    return c.json(body);
  });

  /** 阶段 3：替换为真实鉴权 */
  app.post(SERVER_API_PATHS.AUTH_LOGIN, async (c) => {
    const json: unknown = await c.req.json();
    const parsed = loginRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: "invalid_request", details: parsed.error.flatten() }, 400);
    }

    const stub = loginResponseSchema.parse({
      accessToken: "stub-token",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: parsed.data.email,
      },
    });

    return c.json(stub);
  });

  app.get(SERVER_API_PATHS.DEVICES, (c) => c.json({ devices: [] }));

  return app;
}
