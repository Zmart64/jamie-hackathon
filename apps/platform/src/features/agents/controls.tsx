import { CheckCircle2, CircleDashed, LoaderCircle, ShieldAlert, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assessmentLabel, type Assessment } from "./model";

export function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function RunStatus({ run }: { run: Assessment | undefined }) {
  const label = assessmentLabel(run);
  const icons = {
    "Not tested": CircleDashed,
    "Assessment running": LoaderCircle,
    "Connection failed": Unplug,
    "Assessment incomplete": CircleDashed,
    "Vulnerabilities found": ShieldAlert,
    "No findings in tested scope": CheckCircle2,
  };
  const Icon = icons[label as keyof typeof icons];
  return (
    <Badge variant="outline" className="gap-1.5 py-1 font-normal">
      <Icon
        aria-hidden="true"
        className={run?.state === "running" ? "size-3.5 animate-spin" : "size-3.5"}
      />
      {label}
    </Badge>
  );
}
