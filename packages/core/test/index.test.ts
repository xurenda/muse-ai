import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "@/index.js";

describe("core", () => {
  it("应导出占位版本号", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });
});
