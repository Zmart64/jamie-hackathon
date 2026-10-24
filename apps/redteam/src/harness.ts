import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createAgentSession,
  createMcpExtension,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { browserServerExtension } from "../extensions/browser";
import { chatTargetExtension } from "../extensions/chat-target";
import { redteamExtension } from "../extensions/redteam";
import { boardPath } from "./lib/board";
import { buildGoalMessage, type RedteamMode } from "./goal";

export interface HarnessOptions {
  mode: RedteamMode;
  appDir: string;
  targetUrl: string;
  victimIdentifier: string;
  attackerAddress: string;
  supportAgentUrl: string;
  supportAccountIdentifier: string | undefined;
  modelId: string;
  browserChannel: string;
}

export interface RedteamHarness {
  session: AgentSession;
  goalMessage: string;
  boardFile: string;
  dispose(): void;
}

function readPrompt(appDir: string, name: string): string {
  return readFileSync(path.join(appDir, "prompts", name), "utf8");
}

export async function createRedteamHarness(options: HarnessOptions): Promise<RedteamHarness> {
  const agentDir = path.join(options.appDir, ".pi", "agent");
  mkdirSync(agentDir, { recursive: true });

  const modelRuntime = await ModelRuntime.create({
    modelsPath: path.join(options.appDir, "models.json"),
    modelsStorePath: path.join(agentDir, "models-store.json"),
    authPath: path.join(agentDir, "auth.json"),
  });
  const model = modelRuntime.getModel("abliteration", options.modelId);
  if (model === undefined) {
    throw new Error(
      `Model abliteration/${options.modelId} is not defined in ${path.join(options.appDir, "models.json")}.`,
    );
  }

  const transportPrompt = readPrompt(
    options.appDir,
    options.mode === "browser" ? "browser.md" : "rehearsal.md",
  );
  const extensions = [
    ...(options.mode === "browser"
      ? [
          browserServerExtension({
            channel: options.browserChannel,
            outputDir: path.join(options.appDir, ".playwright"),
            targetUrl: options.targetUrl,
            initPagePath: path.join(options.appDir, "src", "browser-init.ts"),
          }),
          createMcpExtension({ startupWaitMs: 20_000 }),
        ]
      : []),
    redteamExtension,
    ...(options.mode === "rehearsal"
      ? [
          chatTargetExtension({
            baseUrl: options.supportAgentUrl,
            ...(options.supportAccountIdentifier === undefined
              ? {}
              : { accountIdentifier: options.supportAccountIdentifier }),
          }),
        ]
      : []),
  ];

  const resourceLoader = new DefaultResourceLoader({
    cwd: options.appDir,
    agentDir,
    noContextFiles: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noExtensions: true,
    systemPrompt: readPrompt(options.appDir, "attacker.md"),
    appendSystemPrompt: [transportPrompt, readPrompt(options.appDir, "playbook.md")],
    extensionFactories: extensions,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: options.appDir,
    agentDir,
    modelRuntime,
    model,
    thinkingLevel: "off",
    resourceLoader,
    settingsManager: SettingsManager.inMemory(),
    sessionManager: SessionManager.inMemory(options.appDir),
    noTools: "builtin",
  });

  await session.bindExtensions({});

  const goalMessage = buildGoalMessage({
    mode: options.mode,
    targetUrl: options.targetUrl,
    victimIdentifier: options.victimIdentifier,
    attackerAddress: options.attackerAddress,
  });

  return {
    session,
    goalMessage,
    boardFile: boardPath(),
    dispose: () => session.dispose(),
  };
}
