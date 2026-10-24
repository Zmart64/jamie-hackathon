import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type sampleDocuments from "@/data/documents.json";

export type DocumentRow = (typeof sampleDocuments)[number];
export const emptyDocument: DocumentRow = {
  id: 0,
  header: "",
  type: "Narrative",
  status: "In Process",
  target: "0",
  limit: "0",
  reviewer: "",
};

type EditorProps = {
  document: DocumentRow;
  onClose: () => void;
  onSave: (document: DocumentRow) => void;
};

export function DocumentEditor({ document, onClose, onSave }: EditorProps) {
  const [draft, setDraft] = useState(document);
  const [error, setError] = useState("");
  const isNew = document.id === 0;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.header.trim()) {
      setError("Enter a section name.");
      return;
    }
    onSave({
      ...draft,
      header: draft.header.trim(),
      type: draft.type.trim(),
      reviewer: draft.reviewer.trim() || "Assign reviewer",
    });
  }
  function update(field: keyof DocumentRow, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "Add section" : "Edit section"}</SheetTitle>
          <SheetDescription>
            Update this sample document. Changes last until you refresh.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={save} className="grid gap-5 px-4 pb-6">
          <div className="grid gap-2">
            <Label htmlFor="section-name">Section name</Label>
            <Input
              id="section-name"
              value={draft.header}
              onChange={(event) => update("header", event.target.value)}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "section-error" : undefined}
            />
            {error && (
              <p id="section-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="section-type">Section type</Label>
            <Input
              id="section-type"
              value={draft.type}
              onChange={(event) => update("type", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="section-status">Status</Label>
            <Select value={draft.status} onValueChange={(value) => update("status", value)}>
              <SelectTrigger id="section-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In Process">In Process</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="section-target">Target</Label>
              <Input
                id="section-target"
                type="number"
                min="0"
                step="1"
                required
                value={draft.target}
                onChange={(event) => update("target", event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="section-limit">Limit</Label>
              <Input
                id="section-limit"
                type="number"
                min="0"
                step="1"
                required
                value={draft.limit}
                onChange={(event) => update("limit", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="section-reviewer">Reviewer</Label>
            <Input
              id="section-reviewer"
              value={draft.reviewer}
              placeholder="Assign reviewer"
              onChange={(event) => update("reviewer", event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isNew ? "Create section" : "Save changes"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
