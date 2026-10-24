import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { drawBotAvatarFrame } from "bot-avatars";
import { createSproutRenderer } from "./sprout-renderer";

// Keep the real animation simulation; replace only the canvas drawing boundary.
vi.mock("bot-avatars", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bot-avatars")>()),
  drawBotAvatarFrame: vi.fn(),
}));

const draw = vi.mocked(drawBotAvatarFrame);
let renderer: ReturnType<typeof createSproutRenderer>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Path2D", class {});
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  renderer?.dispose();
  renderer = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function start(reducedMotion = false, compact = true) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reducedMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  renderer = createSproutRenderer(
    document.createElement("canvas"),
    document.createElement("canvas"),
    compact ? 32 : 80,
    compact,
  );
  if (!renderer) throw new Error("Expected a Sprout renderer");
  return renderer;
}

it("keeps the inline avatar emoting while idle and after thinking finishes", async () => {
  const sprout = start();
  const firstPose = draw.mock.calls[0]?.[2];
  await vi.advanceTimersByTimeAsync(1500);
  expect(draw.mock.calls.length).toBeGreaterThan(10);
  expect(draw.mock.lastCall?.[2]).not.toEqual(firstPose);

  sprout.setMood("thinking");
  await vi.advanceTimersByTimeAsync(1500);
  expect(draw.mock.lastCall?.[2].w[1]).toBeGreaterThan(0.99);
  // Working head movement must come from the simulation, not a fixed thinking tilt.
  const pitchValues = draw.mock.calls.slice(-30).map((call) => call[2].pitch);
  expect(new Set(pitchValues).size).toBeGreaterThan(1);

  sprout.setMood("idle");
  await vi.advanceTimersByTimeAsync(1500);
  expect(draw.mock.lastCall?.[2].w[0]).toBeGreaterThan(0.99);
  const idlePose = draw.mock.lastCall?.[2];
  await vi.advanceTimersByTimeAsync(500);
  expect(draw.mock.lastCall?.[2]).not.toEqual(idlePose);
});

it("keeps idle and thinking still for reduced motion and stops drawing after disposal", async () => {
  const sprout = start(true);
  const initialDraws = draw.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(draw).toHaveBeenCalledTimes(initialDraws);
  sprout.setMood("thinking");
  const thinkingDraws = draw.mock.calls.length;
  expect(thinkingDraws).toBeGreaterThan(initialDraws);
  await vi.advanceTimersByTimeAsync(1000);
  expect(draw).toHaveBeenCalledTimes(thinkingDraws);
});

it("stops the animation loop when the avatar is removed", async () => {
  const sprout = start();
  await vi.advanceTimersByTimeAsync(100);
  sprout.dispose();
  renderer = null;
  const finalDraws = draw.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(draw).toHaveBeenCalledTimes(finalDraws);
});

it("uses the library's breathing sleep pose and blends back to awake", async () => {
  const sprout = start();
  sprout.setMood("sleeping");
  await vi.advanceTimersByTimeAsync(2000);
  const sleepingPose = draw.mock.lastCall?.[2];
  expect(sleepingPose?.w[2]).toBeGreaterThan(0.99);
  // The draw layer closes the eyes from the sleep weight; the rig dips its head.
  expect(sleepingPose?.pitch).toBeLessThan(-0.1);
  await vi.advanceTimersByTimeAsync(500);
  expect(draw.mock.lastCall?.[2]).not.toEqual(sleepingPose);
  sprout.setMood("idle");
  await vi.advanceTimersByTimeAsync(1500);
  expect(draw.mock.lastCall?.[2].w[0]).toBeGreaterThan(0.99);
  expect(draw.mock.lastCall?.[2].pitch).not.toBe(sleepingPose?.pitch);
});

it("keeps the launcher gently alive without periodic jumps", async () => {
  start(false, false);
  await vi.advanceTimersByTimeAsync(40_000);
  const poses = draw.mock.calls.map((call) => call[2]);
  const heights = poses.map((pose) => pose.y);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(4);
  expect(new Set(poses.map((pose) => pose.breath)).size).toBeGreaterThan(10);
});
