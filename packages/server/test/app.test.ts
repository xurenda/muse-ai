import { describe, expect, it } from "vitest";
import { loadServerConfig } from "@/config.js";
import { createServerApp } from "@/app.js";

describe("loadServerConfig", () => {
  it("应使用默认端口 3000", () => {
    const config = loadServerConfig({});
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toContain("postgresql://");
  });
});

describe("createServerApp", () => {
  it("GET /health 应返回 ok", async () => {
    const app = createServerApp(loadServerConfig({}));
    const res = await app.request("http://localhost/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "server" });
  });

  it("POST /auth/login 合法请求应返回 stub token", async () => {
    const app = createServerApp(loadServerConfig({}));
    const res = await app.request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dev@muse.ai", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("stub-token");
  });

  it("POST /auth/login 非法请求应返回 400", async () => {
    const app = createServerApp(loadServerConfig({}));
    const res = await app.request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", password: "short" }),
    });
    expect(res.status).toBe(400);
  });
});
