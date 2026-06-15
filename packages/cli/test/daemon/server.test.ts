import { describe, expect, it } from "vitest";
import { loadCliConfig } from "@/config.js";
import { createCliApp } from "@/daemon/server.js";

describe("loadCliConfig", () => {
  it("应使用默认端口 7421", () => {
    const config = loadCliConfig({});
    expect(config.port).toBe(7421);
    expect(config.host).toBe("127.0.0.1");
  });

  it("应解析 MUSE_CLI_PORT", () => {
    const config = loadCliConfig({ MUSE_CLI_PORT: "9000" });
    expect(config.port).toBe(9000);
  });
});

describe("createCliApp", () => {
  it("GET /health 应返回 ok", async () => {
    const app = createCliApp(loadCliConfig({}));
    const res = await app.request("http://localhost/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "cli" });
  });
});
