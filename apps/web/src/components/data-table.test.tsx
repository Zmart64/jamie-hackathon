import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { toast } from "sonner";
import { DataTable } from "./data-table";
import { Toaster } from "./ui/sonner";

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <DataTable />
      <Toaster />
    </>,
  );
  return user;
}
afterEach(() => toast.dismiss());

describe("document dashboard", () => {
  it("filters, recovers from an empty search, and resets pagination on filter changes", async () => {
    const user = setup();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 7")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cover page" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search documents" }), "no such document");
    expect(screen.getByText("No matching documents")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Page 1 of 7")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Done" }));
    const table = screen.getByRole("table");
    expect(within(table).queryByText("In Process")).not.toBeInTheDocument();
    expect(within(table).getAllByText("Done").length).toBeGreaterThan(0);
  });

  it("selects only the visible page and toggles optional columns", async () => {
    const user = setup();
    await user.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    expect(screen.getByText("10 of 68 row(s) selected.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Select Cover page" }));
    expect(
      screen.getByRole("checkbox", { name: "Select all on this page" }),
    ).toBePartiallyChecked();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("checkbox", { name: "Select all on this page" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: /Columns/ }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Reviewer" }));
    expect(screen.queryByRole("columnheader", { name: "Reviewer" })).not.toBeInTheDocument();
  });

  it("rejects blank names and negative targets, then creates a section", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Add section" }));
    const name = screen.getByRole("textbox", { name: "Section name" });
    await user.type(name, "   ");
    await user.click(screen.getByRole("button", { name: "Create section" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a section name.");
    await user.clear(name);
    await user.type(name, "Project brief");
    const target = screen.getByRole("spinbutton", { name: "Target" });
    await user.clear(target);
    await user.type(target, "-1");
    await user.click(screen.getByRole("button", { name: "Create section" }));
    expect(target).toBeInvalid();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.clear(target);
    await user.type(target, "10");
    await user.click(screen.getByRole("button", { name: "Create section" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Project brief" })).toBeInTheDocument();
    expect(screen.getByText("0 of 69 row(s) selected.")).toBeInTheDocument();
  });

  it("saves edits and restores a deleted section with undo", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Cover page" }));
    const name = screen.getByRole("textbox", { name: "Section name" });
    await user.clear(name);
    await user.type(name, "Updated cover");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Actions for Updated cover" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete section" }));
    expect(screen.queryByRole("button", { name: "Updated cover" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Updated cover" })).toBeInTheDocument();
    expect(screen.getByText("0 of 68 row(s) selected.")).toBeInTheDocument();
  });

  it("discards edits when the sheet is cancelled", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Cover page" }));
    await user.type(screen.getByRole("textbox", { name: "Section name" }), " draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Cover page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cover page draft" })).not.toBeInTheDocument();
  });
});
