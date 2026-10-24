import { createContext, useContext } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileInput,
  Fingerprint,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  nodeWidth,
  nodeHeight,
  type AssessmentFlowNode,
  type FlowNodeData,
  type Selection,
} from "./canvas-model";

export const CanvasActions = createContext<{
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onExpand: (id: string) => void;
}>({ selection: { kind: "baseline" }, onSelect: () => {}, onExpand: () => {} });

const icons = {
  baseline: Waypoints,
  surface: GitBranch,
  plan: Fingerprint,
  attempt: FileInput,
  verification: ShieldCheck,
  finding: ShieldAlert,
  blocked: ShieldCheck,
  gap: CircleHelp,
};

export function CanvasNode({
  data,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<AssessmentFlowNode>) {
  const { selection, onSelect, onExpand } = useContext(CanvasActions);
  const { setCenter, getZoom } = useReactFlow();
  const Icon = icons[data.selection.kind];
  const active =
    selection.kind === data.selection.kind && selection.findingId === data.selection.findingId;
  return (
    <Card
      className={cn(
        "nopan relative h-full gap-0 rounded-xl py-0 shadow-none",
        active && "border-primary ring-2 ring-primary/10",
      )}
    >
      {data.selection.kind !== "baseline" && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      <Button
        variant="ghost"
        aria-label={`${data.label}: ${data.description}`}
        aria-pressed={active}
        onClick={() => onSelect(data.selection)}
        onFocus={(event) => {
          if (event.target.matches(":focus-visible")) {
            void setCenter(positionAbsoluteX + nodeWidth / 2, positionAbsoluteY + nodeHeight / 2, {
              zoom: Math.max(0.8, getZoom()),
            });
          }
        }}
        className="nodrag h-[66px] w-full justify-start gap-2.5 rounded-b-none px-3 text-left"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border",
            data.selection.kind === "baseline" && "border-foreground bg-foreground text-background",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{data.label}</span>
          <span
            className="mt-0.5 block truncate text-xs font-normal text-muted-foreground"
            title={data.description}
          >
            {data.description}
          </span>
        </span>
      </Button>
      <CanvasNodeFooter data={data} onExpand={onExpand} />
      {(["baseline", "surface", "plan", "attempt", "verification"].includes(data.selection.kind) ||
        data.expandable) && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Card>
  );
}

function CanvasNodeFooter({
  data,
  onExpand,
}: {
  data: FlowNodeData;
  onExpand: (id: string) => void;
}) {
  return (
    <div className="flex h-9 items-center justify-between gap-2 border-t px-3 text-[10px]">
      <span className="truncate text-muted-foreground">{data.meta}</span>
      <div className="flex shrink-0 items-center gap-1">
        <NodeStatus status={data.status} />
        {data.expandable && data.selection.findingId && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="nodrag size-6 rounded-md"
            aria-label={`${data.expanded ? "Collapse" : "Expand"} ${data.label}`}
            aria-expanded={Boolean(data.expanded)}
            onClick={() => onExpand(data.selection.findingId ?? "")}
          >
            <ChevronRight
              className={cn("size-3", data.expanded && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        )}
      </div>
    </div>
  );
}
function NodeStatus({ status }: { status: FlowNodeData["status"] }) {
  const severity = status === "High" || status === "Medium";
  const StatusIcon = status === "Incomplete" ? CircleHelp : CheckCircle2;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-1.5 py-0 text-[10px] font-normal",
        severity && "border-destructive/20 bg-destructive/5 text-destructive",
        status === "Passed" && "border-success/20 bg-success/5 text-success",
        status === "Incomplete" && "border-dashed",
      )}
    >
      {severity ? <ShieldAlert aria-hidden="true" /> : <StatusIcon aria-hidden="true" />}
      {status}
    </Badge>
  );
}
