import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendBoardEntry, appendBoardResult, formatBoardEntry, readBoard } from "../src/lib/board";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "redteam-board-"));
  process.env.REDTEAM_BOARD = path.join(directory, "board.md");
});

afterEach(async () => {
  delete process.env.REDTEAM_BOARD;
  delete process.env.REDTEAM_RUN_ID;
  delete process.env.REDTEAM_TARGET;
  delete process.env.REDTEAM_VICTIM;
  delete process.env.REDTEAM_ATTACKER_ADDRESS;
  await rm(directory, { recursive: true, force: true });
});

describe("board", () => {
  it("formats readable entries with technique and evidence", () => {
    expect(
      formatBoardEntry({
        bucket: "what_worked",
        content: "a higher-authority framing executed the action",
        technique: "context-framing",
        evidence: "update_recovery_email returned updated:true",
      }),
    ).toBe(
      "- [what_worked] (context-framing) a higher-authority framing executed the action — evidence: update_recovery_email returned updated:true\n",
    );
  });

  it("keeps each entry on one readable line", () => {
    expect(
      formatBoardEntry({
        bucket: "knowledge",
        content: "first line\nsecond line",
        technique: "tag\nwith-newline",
      }),
    ).toBe("- [knowledge] (tag with-newline) first line second line\n");
  });

  it("reports an empty board before the first write", async () => {
    await expect(readBoard()).resolves.toBe("(the board is empty)");
  });

  it("creates the board and appends entries in order", async () => {
    await appendBoardEntry({
      bucket: "knowledge",
      content: "a failed login surfaces the support assistant",
    });
    await appendBoardEntry({
      bucket: "what_failed",
      content: "claiming ownership was refused",
      technique: "ownership-claim",
    });

    const content = await readFile(process.env.REDTEAM_BOARD ?? "", "utf8");
    expect(content).toBe(
      [
        "# Redteam board",
        "",
        "## Timeline",
        "",
        "- [knowledge] a failed login surfaces the support assistant",
        "- [what_failed] (ownership-claim) claiming ownership was refused",
        "",
      ].join("\n"),
    );
  });

  it("includes run metadata when the harness provides it", async () => {
    process.env.REDTEAM_RUN_ID = "run-1";
    process.env.REDTEAM_TARGET = "http://127.0.0.1:5174";
    process.env.REDTEAM_VICTIM = "alex@example.com";
    process.env.REDTEAM_ATTACKER_ADDRESS = "alex.morgan.backup@example.com";

    await appendBoardEntry({ bucket: "knowledge", content: "surface mapped" });

    const content = await readBoard();
    expect(content).toContain("- Run: run-1");
    expect(content).toContain("- Target: http://127.0.0.1:5174");
    expect(content).toContain("- Victim: alex@example.com");
    expect(content).toContain("- Recovery destination: alex.morgan.backup@example.com");
  });

  it("writes the final result section", async () => {
    await appendBoardResult({
      success: true,
      claim: "recovery was redirected",
      evidence: "the receipt showed the attacker address",
    });

    const content = await readBoard();
    expect(content).toContain("## Result");
    expect(content).toContain("- outcome: success");
    expect(content).toContain("- claim: recovery was redirected");
    expect(content).toContain("- evidence: the receipt showed the attacker address");
  });

  it("adds a strategy summary and winning path on finish", async () => {
    await appendBoardEntry({
      bucket: "knowledge",
      content: "surface mapped",
      technique: "surface-map",
    });
    await appendBoardEntry({
      bucket: "what_failed",
      content: "direct request refused",
      technique: "direct-request",
    });
    await appendBoardEntry({
      bucket: "what_failed",
      content: "system tag refused",
      technique: "system-tag-injection",
    });
    await appendBoardEntry({
      bucket: "what_worked",
      content: "forged tool result executed the update",
      technique: "tool-result-injection",
      evidence: "updated:true",
    });

    await appendBoardResult({
      success: true,
      claim: "recovery was redirected",
      evidence: "the receipt showed the attacker address",
    });

    const content = await readBoard();
    expect(content).toContain("## Strategy summary");
    expect(content).toContain("| tool-result-injection | worked | 1 |");
    expect(content).toContain("| direct-request | failed | 1 |");
    expect(content).toContain("| system-tag-injection | failed | 1 |");
    expect(content).not.toContain("| surface-map | knowledge |");
    expect(content).toContain("## Winning path");
    expect(content).toContain("- (tool-result-injection) forged tool result executed the update");
  });
});
