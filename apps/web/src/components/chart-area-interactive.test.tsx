import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ChartAreaInteractive } from "./chart-area-interactive";

it("changes the chart range and keeps a selected range when clicked again", async () => {
  const user = userEvent.setup();
  render(<ChartAreaInteractive />);
  await user.click(screen.getByRole("radio", { name: "Last 7 days" }));
  expect(screen.getByText("7 days ending June 30, 2024 · Sample data")).toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: "Last 7 days" }));
  expect(screen.getByRole("radio", { name: "Last 7 days" })).toHaveAttribute("data-state", "on");
  await user.click(screen.getByRole("radio", { name: "Last 30 days" }));
  expect(screen.getByText("30 days ending June 30, 2024 · Sample data")).toBeInTheDocument();
});
