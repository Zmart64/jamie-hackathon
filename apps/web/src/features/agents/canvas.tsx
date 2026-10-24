import { useMemo, useState, type KeyboardEvent } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type FitViewOptions,
} from "@xyflow/react";
import { Hand, Maximize, Minus, MousePointer2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CanvasActions, CanvasNode } from "./canvas-node";
import { buildAssessmentGraph, type Selection } from "./canvas-model";
import type { Assessment } from "./model";
import "@xyflow/react/dist/style.css";
import "./canvas.css";

export { FindingsList } from "./findings-list";
export type { Selection } from "./canvas-model";

const nodeTypes = { assessment: CanvasNode };
const fitOptions: FitViewOptions = {
  padding: { top: "40px", right: "40px", bottom: "130px", left: "40px" },
  minZoom: 0.15,
  maxZoom: 1,
};

type CanvasProps = {
  run: Assessment;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

export function AssessmentCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasStage {...props} />
    </ReactFlowProvider>
  );
}
function CanvasStage({ run, selection, onSelect }: CanvasProps) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [pan, setPan] = useState(true);
  const mobile = useIsMobile();
  const { getViewport, setViewport } = useReactFlow();
  const graph = useMemo(() => buildAssessmentGraph(run, expanded), [run, expanded]);
  function onExpand(id: string) {
    setExpanded((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [80, 0],
      ArrowRight: [-80, 0],
      ArrowUp: [0, 80],
      ArrowDown: [0, -80],
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    const viewport = getViewport();
    void setViewport({ ...viewport, x: viewport.x + delta[0], y: viewport.y + delta[1] });
  }
  return (
    <section
      aria-label="Assessment flow"
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <div className="border-b px-4 py-3 text-sm font-medium">Assessment map</div>
      <div className="assessment-flow h-[560px] min-w-0 sm:h-[600px]">
        <CanvasActions.Provider value={{ selection, onSelect, onExpand }}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView={!mobile}
            fitViewOptions={fitOptions}
            defaultViewport={{
              x: 24,
              y: 100 - (graph.nodes[0]?.position.y ?? 0) * 0.85,
              zoom: 0.85,
            }}
            minZoom={0.15}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            panOnDrag={pan}
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            preventScrolling={false}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="region"
            aria-label="Assessment canvas. Use arrow keys to pan."
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="hsl(var(--border))"
            />
            <Panel
              position="top-left"
              className="pointer-events-none! text-[11px] text-muted-foreground"
            >
              Drag to pan · Select a step to inspect
            </Panel>
            <CanvasControls pan={pan} onPanChange={setPan} />
            <MiniMap
              pannable
              zoomable
              ariaLabel="Assessment minimap"
              className="hidden overflow-hidden rounded-lg border shadow-sm sm:block"
              style={{ width: 150, height: 100, bottom: 18 }}
              nodeColor="hsl(var(--muted-foreground) / 0.25)"
              bgColor="hsl(var(--card))"
              maskColor="hsl(var(--muted) / 0.7)"
              maskStrokeColor="hsl(var(--border))"
            />
          </ReactFlow>
        </CanvasActions.Provider>
      </div>
    </section>
  );
}
function CanvasControls({
  pan,
  onPanChange,
}: {
  pan: boolean;
  onPanChange: (pan: boolean) => void;
}) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel
      position="bottom-left"
      className="flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-sm"
      aria-label="Canvas controls"
    >
      <Button
        variant={pan ? "ghost" : "secondary"}
        size="icon-sm"
        aria-label="Select nodes"
        aria-pressed={!pan}
        onClick={() => onPanChange(false)}
      >
        <MousePointer2 aria-hidden="true" />
      </Button>
      <Button
        variant={pan ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="Pan canvas"
        aria-pressed={pan}
        onClick={() => onPanChange(true)}
      >
        <Hand aria-hidden="true" />
      </Button>
      <span className="mx-1 h-4 border-l" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={zoom <= 0.15}
        onClick={() => {
          void zoomOut();
        }}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-12 px-0 text-xs tabular-nums"
        aria-label="Reset zoom to 100%"
        onClick={() => {
          void zoomTo(1);
        }}
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={zoom >= 1.6}
        onClick={() => {
          void zoomIn();
        }}
      >
        <Plus aria-hidden="true" />
      </Button>
      <span className="mx-1 h-4 border-l" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Fit canvas"
        onClick={() => {
          void fitView(fitOptions);
        }}
      >
        <Maximize aria-hidden="true" />
      </Button>
    </Panel>
  );
}
