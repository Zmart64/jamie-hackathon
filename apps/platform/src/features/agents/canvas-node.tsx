import { createContext, useContext } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  CheckCircle2,
  Brain,
  ChevronRight,
  CircleHelp,
  Crosshair,
  LoaderCircle,
  NotepadText,
  Radar,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { severities } from "./model";
import { SeverityIcon } from "./severity";
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
  baseline: Wrench,
  surface: Radar,
  plan: Brain,
  attempt: Crosshair,
  verification: ShieldCheck,
  finding: ShieldAlert,
  blocked: ShieldBan,
  gap: CircleHelp,
  sharedNotes: NotepadText,
};

export function CanvasNodeIcon({
  kind,
  browser = false,
}: {
  kind: keyof typeof icons;
  browser?: boolean;
}) {
  const Icon = icons[kind];
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
      {browser ? (
        <img src="/brand/google-chrome.svg" alt="" className="size-5" aria-hidden="true" />
      ) : (
        <Icon className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

export function CanvasNode({
  data,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<AssessmentFlowNode>) {
  const { selection, onSelect, onExpand } = useContext(CanvasActions);
  const { setCenter, getZoom } = useReactFlow();
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
        className={cn(
          "nodrag h-[66px] w-full justify-start gap-2.5 rounded-b-none px-3 text-left",
          data.expandable && "pr-9",
        )}
      >
        <CanvasNodeIcon kind={data.selection.kind} />
        <span className="line-clamp-2 min-w-0 text-sm leading-5 font-medium whitespace-normal">
          {data.label}
        </span>
      </Button>
      <CanvasNodeFooter data={data} />
      <CanvasNodeExpand data={data} onExpand={onExpand} />
      {(["baseline", "surface", "plan", "attempt", "verification"].includes(data.selection.kind) ||
        data.expandable) && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </Card>
  );
}

function CanvasNodeExpand({
  data,
  onExpand,
}: {
  data: FlowNodeData;
  onExpand: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute top-5 right-2 flex h-6 items-center">
      {data.expandable && data.selection.findingId && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="nodrag pointer-events-auto size-6 rounded-md"
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
  );
}
export function CanvasNodeFooter({ data }: { data: FlowNodeData }) {
  return (
    <div className="flex h-9 items-center justify-between gap-2 border-t border-border/60 px-3">
      <span className="text-xs text-muted-foreground tabular-nums">
        {(data.durationMs / 1000).toFixed(1)}s
      </span>
      <NodeStatus status={data.status} />
    </div>
  );
}
export function NodeStatus({ status }: { status: FlowNodeData["status"] }) {
  const level = severities.find((value) => value === status);
  const detected = status === "Detected";
  const StatusIcon = status === "Incomplete" ? CircleHelp : CheckCircle2;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-1.5 py-0 text-[10px] font-normal",
        detected && "border-destructive/20 bg-destructive/5 text-destructive",
        (status === "Passed" || status === "Blocked") &&
          "border-success/20 bg-success/5 text-success",
        status === "Incomplete" && "border-dashed",
      )}
    >
      {status === "Running" ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : level ? (
        <SeverityIcon severity={level} />
      ) : detected ? (
        <ShieldAlert aria-hidden="true" />
      ) : (
        <StatusIcon aria-hidden="true" />
      )}
      {status}
    </Badge>
  );
}
