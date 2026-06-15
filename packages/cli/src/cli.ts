#!/usr/bin/env node
import { loadCliConfig } from "./config.js";
import { startCliServer } from "./daemon/server.js";

const command = process.argv[2];

async function main(): Promise<void> {
  switch (command) {
    case "start":
    case undefined:
      startCliServer(loadCliConfig());
      break;
    default:
      console.error(`未知命令: ${command}`);
      console.error("用法: muse start");
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
