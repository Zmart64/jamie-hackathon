import { createRequire } from "node:module";
import path from "node:path";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

export interface BrowserServerOptions {
  channel: string;
  outputDir: string;
  targetUrl: string;
  initPagePath: string;
}

function resolvePlaywrightMcpCli(): string {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("@playwright/mcp/package.json");
  return path.join(path.dirname(packageJson), "cli.js");
}

export function browserServerExtension(options: BrowserServerOptions): ExtensionFactory {
  return (pi) => {
    pi.registerMcpServer("browser", {
      command: process.execPath,
      args: [
        resolvePlaywrightMcpCli(),
        "--browser",
        options.channel,
        "--isolated",
        "--viewport-size",
        "1280x900",
        "--output-dir",
        options.outputDir,
        "--init-page",
        options.initPagePath,
      ],
      env: { REDTEAM_TARGET_URL: options.targetUrl },
      exposure: "direct",
      timeout: 120,
      description:
        "Headed browser for the target application. Navigate, read the accessibility snapshot, click, type, and inspect network requests and responses.",
    });
  };
}

export default browserServerExtension;
