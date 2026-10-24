import { useContext } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrowserFeed } from "./browser-feed";
import { CanvasActions, CanvasNodeFooter, CanvasNodeIcon } from "./canvas-node";
import { demoGeometry, demoSteps, type DemoStep } from "./demo-graph";
import type { AssessmentFlowNode, FlowNodeData } from "./canvas-model";

export function DemoCanvasNode({
  data,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<AssessmentFlowNode>) {
  const step = demoSteps.find((item) => item.id === data.selection.stepId);
  if (!step) return null;
  const geometry = demoGeometry(step);
  const feed = step.feed ? (
    <div className="w-[280px] shrink-0">
      <BrowserFeed id={step.feed} elapsedMs={data.elapsedMs ?? 0} />
    </div>
  ) : null;
  return (
    <div
      className={cn(
        "demo-canvas-node relative flex h-full",
        geometry.side ? "items-center gap-4" : "flex-col justify-end gap-3",
      )}
    >
      {!geometry.side && feed}
      <DemoStepCard data={data} step={step} x={positionAbsoluteX} y={positionAbsoluteY} />
      {geometry.side && feed}
      {geometry.side && <Handle type="source" position={Position.Right} isConnectable={false} />}
    </div>
  );
}

function DemoStepCard({
  data,
  step,
  x,
  y,
}: {
  data: FlowNodeData;
  step: DemoStep;
  x: number;
  y: number;
}) {
  const { onSelect, selection } = useContext(CanvasActions);
  const { setCenter, getZoom } = useReactFlow();
  const active = selection.stepId === step.id;
  const geometry = demoGeometry(step);
  return (
    <Card
      className={cn(
        "relative h-[104px] w-[280px] shrink-0 gap-0 rounded-xl py-0 shadow-none",
        active && "border-primary ring-2 ring-primary/10",
      )}
    >
      {step.parents.length > 0 && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      <Button
        variant="ghost"
        className="nodrag nopan h-[66px] w-full justify-start gap-2.5 rounded-b-none px-3 text-left"
        aria-label={`${data.label}: ${data.description}`}
        aria-pressed={active}
        onClick={() => onSelect(data.selection)}
        onFocus={(event) => {
          if (event.target.matches(":focus-visible")) {
            void setCenter(x + 140, y + geometry.offset + 52, {
              zoom: Math.max(0.8, getZoom()),
            });
          }
        }}
      >
        <CanvasNodeIcon kind={data.selection.kind} browser={Boolean(step.feed)} />
        <span className="line-clamp-2 min-w-0 text-sm leading-5 font-medium whitespace-normal">
          {data.label}
        </span>
      </Button>
      <CanvasNodeFooter data={data} />
      {!geometry.side && demoSteps.some((item) => item.parents.includes(step.id)) && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Card>
  );
}
