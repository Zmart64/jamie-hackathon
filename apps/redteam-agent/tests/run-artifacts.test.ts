import { lstatSync, readlinkSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareCheckArtifacts, prepareRunArtifacts } from "../src/run-artifacts";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "redteam-run-"));
  delete process.env.REDTEAM_BOARD;
});

afterEach(async () => {
  delete process.env.REDTEAM_BOARD;
  await rm(directory, { recursive: true, force: true });
});

describe("run artifacts", () => {
  it("creates a fresh board directory and latest pointer for each run", () => {
    const artifacts = prepareRunArtifacts(directory, "run-1");

    expect(artifacts.boardFile).toBe(path.join(directory, "runs", "run-1", "board.md"));
    expect(process.env.REDTEAM_BOARD).toBe(artifacts.boardFile);
    const latest = path.join(directory, "runs", "latest");
    expect(lstatSync(latest).isSymbolicLink()).toBe(true);
    expect(readlinkSync(latest)).toBe("run-1");
  });

  it("keeps an explicit board path instead of creating a run directory", () => {
    const explicit = path.join(directory, "custom-board.md");
    process.env.REDTEAM_BOARD = explicit;

    const artifacts = prepareRunArtifacts(directory, "run-2");

    expect(artifacts.boardFile).toBe(explicit);
    expect(artifacts.latestLink).toBeUndefined();
    expect(() => lstatSync(path.join(directory, "runs", "latest"))).toThrow();
  });

  it("rejects unsafe run ids", () => {
    expect(() => prepareRunArtifacts(directory, "../escape")).toThrow("REDTEAM_RUN_ID");
  });

  it("uses a check-only board path without creating a run", () => {
    const artifacts = prepareCheckArtifacts(directory);

    expect(artifacts.runId).toBe("check");
    expect(artifacts.boardFile).toBe(path.join(directory, "runs", "check", "board.md"));
    expect(process.env.REDTEAM_BOARD).toBe(artifacts.boardFile);
  });
});
