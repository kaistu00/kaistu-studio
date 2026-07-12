import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Breadcrumb } from "../components/Breadcrumb";

vi.mock("../App.css", () => ({}));

describe("Breadcrumb", () => {
  it("renders crumbs", () => {
    render(<Breadcrumb crumbs={[{ label: "Inicio", tab: "home" }, { label: "Actual" }]} />);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Actual")).toBeInTheDocument();
  });

  it("calls onNavigate when clickable crumb clicked", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<Breadcrumb crumbs={[{ label: "Inicio", tab: "home" }, { label: "Actual" }]} onNavigate={onNavigate} />);
    await user.click(screen.getByText("Inicio"));
    expect(onNavigate).toHaveBeenCalledWith("home");
  });

  it("last crumb is not clickable", () => {
    render(<Breadcrumb crumbs={[{ label: "Solo" }]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
