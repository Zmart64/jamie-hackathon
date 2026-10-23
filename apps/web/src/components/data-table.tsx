import { useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  Columns3,
  MoreVertical,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import sampleDocuments from "@/data/documents.json";
import { DocumentEditor, emptyDocument, type DocumentRow } from "@/components/document-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pageSize = 10;
const optionalColumns = ["Target", "Limit", "Reviewer"] as const;
type Column = (typeof optionalColumns)[number];

function DocumentTableRow({
  document,
  selected,
  columns,
  onSelect,
  onEdit,
  onDelete,
}: {
  document: DocumentRow;
  selected: boolean;
  columns: Set<Column>;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          aria-label={`Select ${document.header}`}
          checked={selected}
          onCheckedChange={onSelect}
        />
      </TableCell>
      <TableCell>
        <Button variant="link" className="h-auto p-0 text-left text-foreground" onClick={onEdit}>
          {document.header}
        </Button>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-muted-foreground">
          {document.type}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
          {document.status === "Done" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <CircleDashed aria-hidden="true" />
          )}
          {document.status}
        </Badge>
      </TableCell>
      {columns.has("Target") && (
        <TableCell className="text-right tabular-nums">{document.target}</TableCell>
      )}
      {columns.has("Limit") && (
        <TableCell className="text-right tabular-nums">{document.limit}</TableCell>
      )}
      {columns.has("Reviewer") && <TableCell>{document.reviewer}</TableCell>}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`Actions for ${document.header}`}
            >
              <MoreVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>Edit section</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function Pagination({
  page,
  pages,
  count,
  selected,
  onPage,
}: {
  page: number;
  pages: number;
  count: number;
  selected: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground" aria-live="polite">
        {selected} of {count} row(s) selected.
      </p>
      <div className="flex items-center gap-2">
        <p className="mr-2" aria-live="polite">
          Page {page + 1} of {pages}
        </p>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="First page"
          disabled={page === 0}
          onClick={() => onPage(0)}
        >
          <ChevronsLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Next page"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Last page"
          disabled={page >= pages - 1}
          onClick={() => onPage(pages - 1)}
        >
          <ChevronsRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function DataTable() {
  const [documents, setDocuments] = useState(sampleDocuments);
  const nextId = useRef(Math.max(...sampleDocuments.map((row) => row.id)) + 1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set<number>());
  const [columns, setColumns] = useState(new Set<Column>(optionalColumns));
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const filtered = documents.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      `${row.header} ${row.type} ${row.reviewer}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedCount = filtered.filter((row) => selected.has(row.id)).length;
  const allSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));
  const someSelected = visible.some((row) => selected.has(row.id));

  function toggleSelection(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectPage(checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const row of visible) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }
  function toggleColumn(column: Column) {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }
  function save(document: DocumentRow) {
    const isNew = document.id === 0;
    const saved = { ...document, id: isNew ? nextId.current++ : document.id };
    setDocuments((previous) =>
      isNew ? [saved, ...previous] : previous.map((row) => (row.id === saved.id ? saved : row)),
    );
    setSearch("");
    setStatus("all");
    setPage(0);
    setEditing(null);
    toast.success(isNew ? "Section created" : "Section updated");
  }
  function remove(document: DocumentRow) {
    setDocuments((previous) => previous.filter((row) => row.id !== document.id));
    setSelected((previous) => {
      const next = new Set(previous);
      next.delete(document.id);
      return next;
    });
    toast("Section deleted", {
      action: { label: "Undo", onClick: () => setDocuments((previous) => [document, ...previous]) },
    });
  }

  return (
    <section
      id="documents"
      tabIndex={-1}
      aria-label="Documents"
      className="flex min-w-0 flex-col gap-4 px-4 lg:px-6"
    >
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setPage(0);
        }}
        className="gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Document status">
            <TabsTrigger value="all">
              Outline <Badge variant="secondary">{documents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="In Process">In Process</TabsTrigger>
            <TabsTrigger value="Done">Done</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 aria-hidden="true" />
                  <span className="hidden sm:inline">Customize </span>Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {optionalColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={columns.has(column)}
                    onCheckedChange={() => toggleColumn(column)}
                  >
                    {column}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setEditing(emptyDocument)}>
              <Plus aria-hidden="true" />
              Add section
            </Button>
          </div>
        </div>
        <TabsContent value={status} className="flex flex-col gap-4">
          <Input
            id="document-search"
            aria-label="Search documents"
            placeholder="Search documents…"
            className="max-w-sm"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Document sections">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all on this page"
                      disabled={!visible.length}
                      checked={allSelected || (someSelected && "indeterminate")}
                      onCheckedChange={(value) => selectPage(value === true)}
                    />
                  </TableHead>
                  <TableHead>Header</TableHead>
                  <TableHead>Section Type</TableHead>
                  <TableHead>Status</TableHead>
                  {columns.has("Target") && <TableHead className="text-right">Target</TableHead>}
                  {columns.has("Limit") && <TableHead className="text-right">Limit</TableHead>}
                  {columns.has("Reviewer") && <TableHead>Reviewer</TableHead>}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((document) => (
                  <DocumentTableRow
                    key={document.id}
                    document={document}
                    columns={columns}
                    selected={selected.has(document.id)}
                    onSelect={() => toggleSelection(document.id)}
                    onEdit={() => setEditing(document)}
                    onDelete={() => remove(document)}
                  />
                ))}
                {!visible.length && (
                  <TableRow>
                    <TableCell colSpan={5 + columns.size} className="h-36 text-center">
                      <p className="font-medium">No matching documents</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try another search or clear your filters.
                      </p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setSearch("");
                          setStatus("all");
                          setPage(0);
                        }}
                      >
                        Clear filters
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={currentPage}
            pages={pages}
            count={filtered.length}
            selected={selectedCount}
            onPage={setPage}
          />
        </TabsContent>
      </Tabs>
      {editing && (
        <DocumentEditor
          key={editing.id}
          document={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </section>
  );
}
