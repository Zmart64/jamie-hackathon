import {
  BOT_AVATAR_OVERSCAN,
  BOT_AVATAR_RISE,
  BotAvatarSim,
  drawBotAvatarFrame,
  restPose,
  type BotAvatarDrawConfig,
  type BotAvatarPose,
} from "bot-avatars";

export type SproutMood = "idle" | "greeting" | "thinking" | "replying";

// Separate, original outlines share the library's pose so every part stays attached.
const bodyOutline = "M50 24C26 23 7 39 7 59C6 79 24 89 50 89C76 89 94 79 93 59C93 39 74 23 50 24Z";
const detailsOutline =
  "M49 30C35 28 26 17 29 5C42 4 52 15 49 30Z" +
  "M50 30C49 16 59 5 73 7C74 20 64 30 50 30Z" +
  "M25 80C28 77 37 78 39 83L40 91C40 98 25 99 21 95C18 91 20 85 25 80Z" +
  "M61 83C63 78 72 77 75 80C80 85 82 91 79 95C75 99 60 98 60 91Z";

interface AvatarLayer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  config: BotAvatarDrawConfig;
}

function createLayer(canvas: HTMLCanvasElement, details: boolean): AvatarLayer | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  return {
    canvas,
    context,
    config: {
      path: new Path2D(details ? detailsOutline : bodyOutline),
      typeKey: details ? "carbon-zero-leaves-feet" : "carbon-zero-body",
      face: "mouth",
      faceX: 50,
      faceY: 51,
      faceScale: details ? 0 : 1,
      color: details ? "#85b760" : "#badf92",
      ink: "#253a30",
      // Smooth shading avoids the plastic renderer's dark rims on these thin parts.
      shading: details ? "smooth" : "plastic",
      depth: details ? 0.25 : 0.95,
      roundness: 1,
      shadow: details ? 0.12 : 0.45,
      highlight: details ? 0.7 : 1.05,
      rim: 0.35,
      spread: 1.6,
      theme: "light",
    },
  };
}

function paintLayer(layer: AvatarLayer, size: number, pose: BotAvatarPose, still: boolean) {
  // Supersample even on 1× screens; redraw at the current display density on zoom.
  const dpr = Math.max(2, Math.min(3, window.devicePixelRatio));
  const resolution = Math.round(size * BOT_AVATAR_OVERSCAN * dpr);
  if (layer.canvas.width !== resolution) {
    layer.canvas.width = resolution;
    layer.canvas.height = resolution;
  }
  layer.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  layer.config.dpr = dpr;
  layer.config.still = still;
  drawBotAvatarFrame(layer.context, size, pose, layer.config);
}

export function createSproutRenderer(
  body: HTMLCanvasElement,
  details: HTMLCanvasElement,
  size: number,
  compact: boolean,
) {
  const bodyLayer = createLayer(body, false);
  const detailLayer = createLayer(details, true);
  if (!bodyLayer || !detailLayer) return null;
  const layers = [detailLayer, bodyLayer];
  const sim = new BotAvatarSim(0.35);
  sim.setTurn(0.45);
  sim.setJump({
    height: 18,
    spin: 0,
    every: 12,
    squash: 1.45,
    stretch: 1.2,
    squashEase: "bouncy",
    riseEase: "bouncy",
  });
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mood: SproutMood = "idle";
  let frame = 0;
  let lastTime = 0;
  let visible = true;
  let disposed = false;
  let firstPaint = true;

  function paint() {
    const still = compact || motion.matches;
    const pose = still ? restPose(sim.state) : { ...sim.pose };
    if (mood === "thinking") {
      pose.pitch = 0.16;
      pose.roll = -0.1;
      pose.lookY = -0.4;
    }
    for (const layer of layers) paintLayer(layer, size, pose, still || firstPaint);
    firstPaint = false;
  }

  function animate(time: number) {
    frame = 0;
    if (disposed) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    sim.update(dt * 1.3);
    paint();
    frame = window.requestAnimationFrame(animate);
  }

  function refresh() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (disposed || document.hidden || !visible) return;
    paint();
    if (!compact && !motion.matches) frame = window.requestAnimationFrame(animate);
  }

  function followPointer(event: PointerEvent) {
    if (compact || motion.matches) return;
    const bounds = body.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / size;
    const y = (event.clientY - bounds.top - bounds.height / 2 - BOT_AVATAR_RISE * size) / size;
    const distance = Math.hypot(x, y);
    const strength = Math.max(0, Math.min(1, (3 - distance) / 2));
    sim.setPointer(x / Math.max(1, distance), y / Math.max(1, distance), strength);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    refresh();
  });
  observer.observe(body);
  motion.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("resize", refresh);
  if (!compact) window.addEventListener("pointermove", followPointer, { passive: true });
  refresh();

  return {
    setMood(next: SproutMood) {
      if (mood === next) return;
      mood = next;
      sim.setState(next === "replying" ? "working" : "default");
      if (next === "greeting" && !motion.matches) sim.poke();
      refresh();
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("pointermove", followPointer);
    },
  };
}
