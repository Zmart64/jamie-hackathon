import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentInventory } from "./inventory";
import { createSampleAgents } from "./fixtures";
import { severities, type Severity } from "./model";
import { SeverityIcon, SeverityLabel } from "./severity";

function filledBars(severity: Severity): number {
  const { container } = render(<SeverityIcon severity={severity} />);
  return container.querySelectorAll('rect[data-filled="true"]').length;
}

describe("severity display", () => {
  it("fills three bars for High, two for Medium and one for Low", () => {
    expect(severities.map(filledBars)).toEqual([3, 2, 1]);
  });

  it("colors each level with its own token and hides the icon from assistive technology", () => {
    const { container } = render(
      <>
        {severities.map((severity) => (
          <SeverityIcon key={severity} severity={severity} />
        ))}
      </>,
    );
    const icons = [...container.querySelectorAll("svg")];
    expect(icons.map((icon) => icon.getAttribute("class"))).toEqual([
      expect.stringContaining("text-severity-high"),
      expect.stringContaining("text-severity-medium"),
      expect.stringContaining("text-severity-low"),
    ]);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("always states the level in words, with an optional count", () => {
    render(
      <>
        <SeverityLabel severity="Medium" />
        <SeverityLabel severity="Low" count={2} />
      </>,
    );
    expect(screen.getByText("Medium")).toBeVisible();
    expect(screen.getByText("2 Low")).toBeVisible();
  });

  it("summarizes inventory findings per level and falls back to words without findings", () => {
    render(<AgentInventory agents={createSampleAgents()} />);
    const rowFor = (name: string) =>
      within(screen.getByRole("link", { name }).closest("tr") as HTMLElement);
    const support = rowFor("Customer support assistant");
    expect(support.getByText("1 High")).toBeVisible();
    expect(support.getByText("2 Medium")).toBeVisible();
    expect(support.getByText("1 Low")).toBeVisible();
    const research = rowFor("Internal research agent");
    expect(research.getByText("None")).toBeVisible();
    expect(research.queryByText(/High|Medium|Low/)).not.toBeInTheDocument();
  });
});
