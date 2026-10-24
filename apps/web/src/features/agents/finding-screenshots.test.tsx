import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { recoveryFinding } from "./demo";
import { FindingReport } from "./finding-report";
import { sampleFindings } from "./fixtures";

describe("finding success screenshots", () => {
  it("shows the three recorded success frames before expanding textual evidence", () => {
    render(<FindingReport finding={recoveryFinding} index={0} recorded />);
    const gallery = within(screen.getByRole("region", { name: "Success screenshots" }));
    expect(gallery.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "/demo/assessment/system.png",
      "/demo/assessment/tool-result.png",
      "/demo/assessment/persistence.png",
    ]);
    expect(gallery.queryByText(/S[1-4] ·/)).not.toBeInTheDocument();
    expect(gallery.queryByText(/original recording/i)).not.toBeInTheDocument();
    for (const screenshot of recoveryFinding.screenshots!) {
      expect(gallery.getByText(screenshot.title)).toBeVisible();
      expect(gallery.queryByText(screenshot.description)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "View evidence & reproduction" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(recoveryFinding.input)).not.toBeInTheDocument();
  });

  it("opens each screenshot with the keyboard and restores focus on close", async () => {
    const user = userEvent.setup();
    render(<FindingReport finding={recoveryFinding} index={0} recorded />);
    for (const screenshot of recoveryFinding.screenshots!) {
      const trigger = screen.getByRole("button", {
        name: `Expand screenshot: ${screenshot.title}`,
      });
      trigger.focus();
      await user.keyboard("{Enter}");
      const dialog = screen.getByRole("dialog", { name: screenshot.title });
      expect(within(dialog).getByRole("img", { name: screenshot.description })).toHaveAttribute(
        "src",
        screenshot.src,
      );
      expect(within(dialog).queryByText(screenshot.description)).not.toBeInTheDocument();
      expect(within(dialog).queryByText(/S[1-4] ·|original recording/i)).not.toBeInTheDocument();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    }
  });

  it("lets a failed preview open, retries a failed full image, and preserves text evidence", async () => {
    const user = userEvent.setup();
    render(<FindingReport finding={recoveryFinding} index={0} recorded />);
    const screenshot = recoveryFinding.screenshots![0]!;
    fireEvent.error(screen.getByRole("img", { name: screenshot.description }));
    expect(screen.getByText("Preview unavailable. Open to retry.")).toBeVisible();
    const trigger = screen.getByRole("button", { name: `Expand screenshot: ${screenshot.title}` });
    await user.click(trigger);
    const dialog = within(screen.getByRole("dialog", { name: screenshot.title }));
    fireEvent.error(dialog.getByRole("img"));
    expect(dialog.getByRole("status")).toHaveTextContent("Screenshot unavailable");
    await user.click(dialog.getByRole("button", { name: "Retry screenshot" }));
    expect(dialog.getByRole("img")).toHaveAttribute("src", screenshot.src);
    expect(dialog.queryByRole("status")).not.toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "View evidence & reproduction" }));
    expect(screen.getByText(recoveryFinding.evidence)).toBeVisible();
  });

  it.each([undefined, []])(
    "does not attach unrelated screenshots to sample findings (%s)",
    (screenshots) => {
      const finding = sampleFindings[0]!;
      render(
        <FindingReport
          finding={{ ...finding, ...(screenshots && { screenshots }) }}
          index={0}
          recorded={false}
        />,
      );
      expect(screen.getByRole("heading", { name: finding.title })).toBeVisible();
      expect(screen.queryByRole("region", { name: "Success screenshots" })).not.toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    },
  );
});
