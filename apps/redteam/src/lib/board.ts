import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";

export type BoardBucket = "knowledge" | "what_failed" | "what_worked";

export interface BoardEntry {
  bucket: BoardBucket;
  content: string;
  technique?: string;
  evidence?: string;
}

export interface BoardResult {
  success: boolean;
  claim: string;
  evidence: string;
}

interface SummaryRow {
  technique: string;
  outcome: BoardBucket;
  count: number;
  firstIndex: number;
}

const MAX_READ_CHARS = 20_000;
const BUCKET_PRIORITY: Record<BoardBucket, number> = {
  what_worked: 0,
  what_failed: 1,
  knowledge: 2,
};

export function boardPath(): string {
  return path.resolve(process.env.REDTEAM_BOARD ?? "board.md");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function boardHeader(): string {
  const metadata: Array<[string, string | undefined]> = [
    ["Run", process.env.REDTEAM_RUN_ID],
    ["Target", process.env.REDTEAM_TARGET],
    ["Victim", process.env.REDTEAM_VICTIM],
    ["Recovery destination", process.env.REDTEAM_ATTACKER_ADDRESS],
  ];
  const present = metadata.filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1].trim().length > 0,
  );
  const lines = ["# Redteam board", ""];
  for (const [label, value] of present) lines.push(`- ${label}: ${oneLine(value)}`);
  if (present.length > 0) lines.push("");
  lines.push("## Timeline", "");
  return `${lines.join("\n")}\n`;
}

async function readBoardContent(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) return "";
    throw error;
  }
}

async function missingHeader(file: string): Promise<string> {
  const existing = await readBoardContent(file);
  if (existing.length === 0) return boardHeader();
  return existing.endsWith("\n") ? "" : "\n";
}

export function formatBoardEntry(entry: BoardEntry): string {
  const technique = entry.technique ? ` (${oneLine(entry.technique)})` : "";
  const evidence = entry.evidence ? ` — evidence: ${oneLine(entry.evidence)}` : "";
  return `- [${entry.bucket}]${technique} ${oneLine(entry.content)}${evidence}\n`;
}

export async function appendBoardEntry(entry: BoardEntry): Promise<string> {
  const file = boardPath();
  await mkdir(path.dirname(file), { recursive: true });
  await withFileMutationQueue(file, async () => {
    const prefix = await missingHeader(file);
    await appendFile(file, prefix + formatBoardEntry(entry), "utf8");
  });
  return file;
}

export function summarizeEntries(content: string): SummaryRow[] {
  const rows = new Map<string, SummaryRow>();
  for (const [index, line] of content.split("\n").entries()) {
    const match = /^- \[(knowledge|what_failed|what_worked)\](?: \(([^)]+)\))? (.+)$/.exec(line);
    if (match === null) continue;
    const bucket = match[1];
    if (bucket !== "knowledge" && bucket !== "what_failed" && bucket !== "what_worked") {
      continue;
    }
    const technique = match[2] ?? "(untagged)";
    const existing = rows.get(technique);
    if (existing === undefined) {
      rows.set(technique, { technique, outcome: bucket, count: 1, firstIndex: index });
      continue;
    }
    existing.count += 1;
    if (BUCKET_PRIORITY[bucket] < BUCKET_PRIORITY[existing.outcome]) {
      existing.outcome = bucket;
    }
  }
  return [...rows.values()].sort((left, right) => {
    const priority = BUCKET_PRIORITY[left.outcome] - BUCKET_PRIORITY[right.outcome];
    if (priority !== 0) return priority;
    const count = right.count - left.count;
    if (count !== 0) return count;
    return left.firstIndex - right.firstIndex;
  });
}

function outcomeLabel(bucket: BoardBucket): string {
  if (bucket === "what_worked") return "worked";
  if (bucket === "what_failed") return "failed";
  return "knowledge";
}

function strategySummary(content: string): string | undefined {
  const rows = summarizeEntries(content).filter((row) => row.outcome !== "knowledge");
  if (rows.length === 0) return undefined;
  const lines = [
    "## Strategy summary",
    "",
    "| Technique | Outcome | Entries |",
    "| --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| ${oneLine(row.technique)} | ${outcomeLabel(row.outcome)} | ${row.count} |`);
  }
  return lines.join("\n");
}

function winningPath(content: string): string | undefined {
  const winners = content
    .split("\n")
    .filter((line) => line.startsWith("- [what_worked]"))
    .map((line) => line.replace(/^- \[what_worked\] /, "- "));
  if (winners.length === 0) return undefined;
  return ["## Winning path", "", ...winners].join("\n");
}

export async function appendBoardResult(result: BoardResult): Promise<string> {
  const file = boardPath();
  await mkdir(path.dirname(file), { recursive: true });
  await withFileMutationQueue(file, async () => {
    const existing = await readBoardContent(file);
    const base = existing.length === 0 ? boardHeader() : existing;
    const outcome = result.success ? "success" : "not achieved";
    const resultSection = `\n## Result\n- outcome: ${outcome}\n- claim: ${oneLine(result.claim)}\n- evidence: ${oneLine(result.evidence)}\n`;
    const summary = strategySummary(base);
    const pathSection = winningPath(base);
    const extras = [summary, pathSection]
      .filter((section): section is string => section !== undefined)
      .map((section) => `\n${section}\n`)
      .join("");
    const prefix = base.endsWith("\n") ? "" : "\n";
    await appendFile(file, `${prefix}${resultSection}${extras}`, "utf8");
  });
  return file;
}

export async function readBoard(): Promise<string> {
  const file = boardPath();
  try {
    const content = await readFile(file, "utf8");
    if (content.trim().length === 0) return "(the board is empty)";
    if (content.length <= MAX_READ_CHARS) return content;
    return `(earlier entries omitted)\n${content.slice(-MAX_READ_CHARS)}`;
  } catch (error) {
    if (hasCode(error, "ENOENT")) return "(the board is empty)";
    throw error;
  }
}
