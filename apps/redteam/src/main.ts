import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createRedteamHarness, type RedteamHarness } from "./harness";
import type { RedteamMode } from "./goal";
import { appendBoardResult } from "./lib/board";
import { prepareCheckArtifacts, prepareRunArtifacts, type RunArtifacts } from "./run-artifacts";

interface CliOptions {
  mode: RedteamMode;
  check: boolean;
  verbose: boolean;
  goal: string | undefined;
}

interface RuntimeConfig {
  apiKey: string | undefined;
  modelId: string;
  targetUrl: string;
  victimIdentifier: string;
  attackerAddress: string;
  supportAgentUrl: string;
  supportAccountIdentifier: string | undefined;
  browserChannel: string;
  timeoutSeconds: number;
  maxToolCalls: number;
}

interface ParsedValue {
  value: string;
  index: number;
}

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_TOOLS = ["board_read", "board_write", "finish"];
const CHAT_TOOLS = ["chat_send", "chat_history", "chat_reset"];

function printUsage(): void {
  console.log(`Usage: pnpm --filter @strain/redteam start -- [options]

Options:
  --mode browser|rehearsal  Browser demo or Playwright-free rehearsal (default: browser)
  --check                   Build the harness, connect tools, print them, and exit
  --verbose                 Stream assistant text as it arrives
  --goal <text>             Override the generated goal message
  -h, --help                Show this help`);
}

function isAny(value: string, ...candidates: string[]): boolean {
  return candidates.includes(value);
}

function readOptionValue(
  argv: string[],
  index: number,
  arg: string,
  option: string,
  inlinePrefix: string,
): ParsedValue {
  if (arg === option) {
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${option} requires a value.`);
    return { value, index: index + 1 };
  }
  const value = arg.slice(inlinePrefix.length);
  if (value === "") throw new Error(`${option} requires a value.`);
  return { value, index };
}

function parseMode(value: string): RedteamMode {
  if (value === "browser") return "browser";
  if (value === "rehearsal") return "rehearsal";
  throw new Error(`Unknown mode: ${value}. Use browser or rehearsal.`);
}

function parseArgs(argv: string[]): CliOptions {
  let mode: RedteamMode = "browser";
  let check = false;
  let verbose = false;
  let goal: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined || arg === "--") continue;
    if (isAny(arg, "--help", "-h")) {
      printUsage();
      process.exit(0);
    }
    if (arg === "--check") {
      check = true;
      continue;
    }
    if (isAny(arg, "--verbose", "-v")) {
      verbose = true;
      continue;
    }
    if (arg === "--mode" || arg.startsWith("--mode=")) {
      const parsed = readOptionValue(argv, index, arg, "--mode", "--mode=");
      mode = parseMode(parsed.value);
      index = parsed.index;
      continue;
    }
    if (arg === "--goal") {
      const parsed = readOptionValue(argv, index, arg, "--goal", "--goal=");
      goal = parsed.value;
      index = parsed.index;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return { mode, check, verbose, goal };
}

function loadEnvFileIfMissing(file: string): void {
  if (!existsSync(file)) return;
  const parsed = parseEnv(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadEnvironment(): void {
  loadEnvFileIfMissing(path.join(APP_DIR, ".env"));
}

function envOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function envOr(name: string, fallback: string): string {
  return envOptional(name) ?? fallback;
}

function envPositiveInt(name: string, fallback: number): number {
  const value = envOptional(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readRuntimeConfig(options: CliOptions): RuntimeConfig {
  const apiKey = envOptional("ABLITERATION_API_KEY");
  if (apiKey === undefined && !options.check) {
    throw new Error("ABLITERATION_API_KEY is not set. Put it in apps/redteam/.env.");
  }
  const modelId =
    envOptional("ABLITERATION_MODEL") ??
    envOptional("ATTACKER_MODEL") ??
    "abliterated-model-large-flash";
  const supportAgentUrl =
    envOptional("SUPPORT_AGENT_URL") ??
    envOptional("ATTACKER_TARGET_URL") ??
    "http://127.0.0.1:8000";
  return {
    apiKey,
    modelId,
    targetUrl: envOr("TARGET_URL", "http://127.0.0.1:5174"),
    victimIdentifier: envOr("VICTIM_IDENTIFIER", "alex@example.com"),
    attackerAddress: envOr("ATTACKER_ADDRESS", "alex.morgan.backup@example.com"),
    supportAgentUrl,
    supportAccountIdentifier: envOptional("SUPPORT_ACCOUNT_IDENTIFIER"),
    browserChannel: envOr("BROWSER_CHANNEL", "chrome"),
    timeoutSeconds: envPositiveInt("REDTEAM_TIMEOUT_SECONDS", 300),
    maxToolCalls: envPositiveInt("REDTEAM_MAX_TOOL_CALLS", 120),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function checkReachable(label: string, url: string): Promise<void> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    throw new Error(`${label} is not reachable at ${url}. Start it before running.`);
  }
}

async function checkSupportAgent(url: string): Promise<void> {
  const endpoint = `${url.replace(/\/+$/, "")}/health`;
  let response: Response;
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(3_000) });
  } catch {
    throw new Error(
      `Support agent is not reachable at ${endpoint}. Run \`make support-agent\` first.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Support agent health check failed (${response.status}) at ${endpoint}.`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Support agent health check returned an invalid response.");
  }
  if (!isRecord(data) || data.configured !== true) {
    throw new Error(
      "Support agent is running but has no Anthropic key. Set ANTHROPIC_API_KEY in apps/support-agent/.env.",
    );
  }
}

async function preflight(mode: RedteamMode, config: RuntimeConfig): Promise<void> {
  if (mode === "browser") await checkReachable("Demo site", config.targetUrl);
  await checkSupportAgent(config.supportAgentUrl);
}

function printHeader(options: CliOptions, config: RuntimeConfig, artifacts: RunArtifacts): void {
  console.log(`redteam: ${options.mode} mode`);
  console.log(`run:     ${artifacts.runId}`);
  console.log(
    `model:   abliteration/${config.modelId}${config.apiKey === undefined ? " (no API key)" : ""}`,
  );
  console.log(`target:  ${config.targetUrl}`);
  console.log(`board:   ${artifacts.boardFile}`);
  if (artifacts.latestLink !== undefined) console.log(`latest:  ${artifacts.latestLink}`);
}

function preview(value: unknown, maxChars: number): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) return "undefined";
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function hasExpectedTools(names: string[], mode: RedteamMode): boolean {
  const boardReady = BOARD_TOOLS.every((name) => names.includes(name));
  const targetReady =
    mode === "browser"
      ? names.some((name) => name.startsWith("mcp__browser__"))
      : CHAT_TOOLS.every((name) => names.includes(name));
  return boardReady && targetReady;
}

async function waitForTools(
  session: AgentSession,
  mode: RedteamMode,
  timeoutMs: number,
): Promise<string[]> {
  const started = Date.now();
  for (;;) {
    const names = session.getActiveToolNames();
    if (hasExpectedTools(names, mode)) return names;
    if (Date.now() - started >= timeoutMs) return names;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function logSessionEvent(event: AgentSessionEvent, verbose: boolean): void {
  switch (event.type) {
    case "tool_execution_start":
      console.log(`→ ${event.toolName} ${preview(event.args as unknown, 300)}`);
      break;
    case "tool_execution_end": {
      const duration = event.durationMs === undefined ? "" : ` ${Math.round(event.durationMs)}ms`;
      console.log(`${event.isError ? "✗" : "✓"} ${event.toolName}${duration}`);
      break;
    }
    case "message_update":
      if (verbose && event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "agent_settled":
      if (verbose) process.stdout.write("\n");
      break;
    default:
      break;
  }
}

function installInterruptHandler(session: AgentSession): () => void {
  let interrupting = false;
  const onSigint = (): void => {
    if (interrupting) process.exit(130);
    interrupting = true;
    console.error("\nInterrupting the redteam run…");
    void session.abort();
  };
  process.on("SIGINT", onSigint);
  return () => process.off("SIGINT", onSigint);
}

async function runCheck(harness: RedteamHarness, mode: RedteamMode): Promise<void> {
  const names = await waitForTools(harness.session, mode, 20_000);
  console.log(`tools:   ${names.join(", ")}`);
  if (!hasExpectedTools(names, mode)) {
    throw new Error(
      `Tool wiring is incomplete for ${mode} mode. Expected the board tools, finish, and ${
        mode === "browser" ? "mcp__browser__*" : "the chat transport tools"
      }.`,
    );
  }
  console.log("check:   ok");
}

function requestStop(session: AgentSession, reason: string, current: string | undefined): string {
  if (current !== undefined) return current;
  console.error(`redteam: ${reason} exhausted; stopping.`);
  void session.abort().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`redteam: could not abort the session: ${message}`);
  });
  return reason;
}

async function recordUnconfirmedStop(stoppedBy: string | undefined): Promise<void> {
  const claim =
    stoppedBy === undefined
      ? "The agent ended without calling finish."
      : `Run stopped by ${stoppedBy} before a confirmed result.`;
  await appendBoardResult({
    success: false,
    claim,
    evidence: "The board records the attempts and observations made before the stop.",
  });
}

async function runAgent(
  harness: RedteamHarness,
  options: CliOptions,
  config: RuntimeConfig,
): Promise<void> {
  let finished = false;
  let stoppedBy: string | undefined;
  let toolCalls = 0;

  const unsubscribe = harness.session.subscribe((event) => {
    if (event.type === "tool_execution_end") {
      toolCalls += 1;
      if (event.toolName === "finish" && !event.isError) finished = true;
      if (!finished && toolCalls >= config.maxToolCalls) {
        stoppedBy = requestStop(
          harness.session,
          `tool-call budget (${config.maxToolCalls})`,
          stoppedBy,
        );
      }
    }
    logSessionEvent(event, options.verbose);
  });
  const removeInterruptHandler = installInterruptHandler(harness.session);
  const timer = setTimeout(() => {
    if (finished) return;
    stoppedBy = requestStop(harness.session, `time budget (${config.timeoutSeconds}s)`, stoppedBy);
  }, config.timeoutSeconds * 1_000);

  try {
    await harness.session.prompt(options.goal ?? harness.goalMessage);
    if (!finished) await recordUnconfirmedStop(stoppedBy);
    console.log(
      `\n${stoppedBy === undefined ? "run settled" : "run stopped"}; board: ${harness.boardFile}`,
    );
  } catch (error) {
    if (stoppedBy === undefined) throw error;
    await recordUnconfirmedStop(stoppedBy);
    console.log(`\nrun stopped; board: ${harness.boardFile}`);
  } finally {
    clearTimeout(timer);
    removeInterruptHandler();
    unsubscribe();
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadEnvironment();
  process.chdir(APP_DIR);
  const config = readRuntimeConfig(options);
  if (!options.check) await preflight(options.mode, config);

  const artifacts = options.check
    ? prepareCheckArtifacts(APP_DIR)
    : prepareRunArtifacts(APP_DIR, envOptional("REDTEAM_RUN_ID"));
  process.env.REDTEAM_RUN_ID = artifacts.runId;
  process.env.REDTEAM_TARGET = config.targetUrl;
  process.env.REDTEAM_VICTIM = config.victimIdentifier;
  process.env.REDTEAM_ATTACKER_ADDRESS = config.attackerAddress;
  printHeader(options, config, artifacts);

  const harness = await createRedteamHarness({
    mode: options.mode,
    appDir: APP_DIR,
    targetUrl: config.targetUrl,
    victimIdentifier: config.victimIdentifier,
    attackerAddress: config.attackerAddress,
    supportAgentUrl: config.supportAgentUrl,
    supportAccountIdentifier: config.supportAccountIdentifier,
    modelId: config.modelId,
    browserChannel: config.browserChannel,
  });

  try {
    if (options.check) {
      await runCheck(harness, options.mode);
      return;
    }
    await runAgent(harness, options, config);
  } finally {
    harness.dispose();
  }
}

run().then(
  () => process.exit(0),
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`redteam: ${message}`);
    process.exit(1);
  },
);
