import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Choice } from "./controls";
import { blankConfig, connections, type AgentConfig } from "./model";

export function validateAgent(draft: AgentConfig): string {
  if (!draft.name.trim()) return "Enter an agent name.";
  if (validAddress(draft)) return "";
  return draft.connection === "Mail"
    ? "Enter a valid email address."
    : "Enter a valid URL starting with http:// or https://.";
}
function validAddress(draft: AgentConfig): boolean {
  const address = draft.address.trim();
  if (draft.connection === "Mail") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  try {
    return ["http:", "https:"].includes(new URL(address).protocol);
  } catch {
    return false;
  }
}
export function AgentSetup({ onCreate }: { onCreate: (config: AgentConfig) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Add agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add an agent</DialogTitle>
        </DialogHeader>
        <AgentForm
          onCreate={(config) => {
            setOpen(false);
            onCreate(config);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
function AgentForm({ onCreate }: { onCreate: (config: AgentConfig) => void }) {
  const [draft, setDraft] = useState(blankConfig);
  const [error, setError] = useState("");
  const isMail = draft.connection === "Mail";
  function update(patch: Partial<AgentConfig>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateAgent(draft);
    if (message) {
      setError(message);
      return;
    }
    onCreate({ ...draft, name: draft.name.trim(), address: draft.address.trim() });
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="agent-name">Agent name</Label>
        <Input
          id="agent-name"
          name="name"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder="e.g. Customer support assistant"
          maxLength={80}
          required
        />
      </div>
      <Choice
        id="agent-connection"
        label="Connection method"
        value={draft.connection}
        options={connections}
        onChange={(value) => {
          const connection = connections.find((item) => item === value);
          if (connection) update({ connection, address: "" });
        }}
      />
      <div className="grid gap-2">
        <Label htmlFor="agent-address">{isMail ? "Email address" : "URL"}</Label>
        <Input
          id="agent-address"
          name="address"
          type={isMail ? "email" : "url"}
          placeholder={isMail ? "agent@example.com" : "https://example.com/agent"}
          value={draft.address}
          onChange={(event) => update({ address: event.target.value })}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="border-t pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">Add</Button>
      </DialogFooter>
    </form>
  );
}
