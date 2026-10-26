import { lstatSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface RunArtifacts {
  runId: string;
  boardFile: string;
  latestLink: string | undefined;
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function timestampRunId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\./g, "-")
    .replace("Z", "");
}

function validateRunId(runId: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error(
      "REDTEAM_RUN_ID may contain only letters, numbers, dots, dashes, and underscores.",
    );
  }
}

function replaceLatestLink(link: string, runId: string): void {
  try {
    const stats = lstatSync(link);
    if (stats.isSymbolicLink() || stats.isFile()) unlinkSync(link);
    else rmSync(link, { recursive: true, force: true });
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
  try {
    symlinkSync(runId, link, "dir");
  } catch {
    writeFileSync(`${link}.txt`, `${runId}\n`, "utf8");
  }
}

export function prepareRunArtifacts(
  appDir: string,
  requestedRunId: string | undefined,
): RunArtifacts {
  const runId = requestedRunId ?? timestampRunId();
  validateRunId(runId);
  const customBoard = process.env.REDTEAM_BOARD?.trim();
  if (customBoard !== undefined && customBoard !== "") {
    const boardFile = path.resolve(customBoard);
    process.env.REDTEAM_BOARD = boardFile;
    return { runId, boardFile, latestLink: undefined };
  }

  const runsDir = path.join(appDir, "runs");
  const runDir = path.join(runsDir, runId);
  mkdirSync(runDir, { recursive: true });
  const boardFile = path.join(runDir, "board.md");
  process.env.REDTEAM_BOARD = boardFile;
  const latestLink = path.join(runsDir, "latest");
  replaceLatestLink(latestLink, runId);
  return { runId, boardFile, latestLink };
}

export function prepareCheckArtifacts(appDir: string): RunArtifacts {
  const customBoard = process.env.REDTEAM_BOARD?.trim();
  const boardFile =
    customBoard !== undefined && customBoard !== ""
      ? path.resolve(customBoard)
      : path.join(appDir, "runs", "check", "board.md");
  process.env.REDTEAM_BOARD = boardFile;
  return { runId: "check", boardFile, latestLink: undefined };
}
