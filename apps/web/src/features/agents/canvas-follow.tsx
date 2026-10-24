import { useEffect } from "react";
import { getNodesBounds, getViewportForBounds, useReactFlow, useStore } from "@xyflow/react";
import { buildDemoGraph } from "./demo-graph";

// Follow stage transitions, never every clock tick. Manual navigation takes precedence.
export function CanvasFollow({ stage, enabled }: { stage: string; enabled: boolean }) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { setViewport, viewportInitialized } = useReactFlow();
  useEffect(() => {
    if (!enabled || !viewportInitialized || !width || !height) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = buildDemoGraph(20_000).nodes.filter((node) => stage.split(",").includes(node.id));
    if (!nodes.length) return;
    const viewport = getViewportForBounds(
      getNodesBounds(nodes),
      width,
      height - 80,
      0.2,
      0.95,
      0.12,
    );
    void setViewport({ ...viewport, y: viewport.y + 30 }, { duration: reducedMotion ? 0 : 450 });
  }, [stage, enabled, viewportInitialized, width, height, setViewport]);
  return null;
}
