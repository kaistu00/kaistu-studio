import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "../components/IconButton";

vi.mock("../App.css", () => ({}));

describe("IconButton", () => {
  it("renders icon and label", () => {
    render(<IconButton icon="search" label="Buscar" />);
    expect(screen.getByText("Buscar")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
  });

  it("renders icon only", () => {
    render(<IconButton icon="close" iconOnly />);
    expect(screen.getByText("close")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("icon-btn--icon-only");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IconButton icon="refresh" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies custom className", () => {
    render(<IconButton icon="test" className="my-btn" />);
    expect(screen.getByRole("button")).toHaveClass("my-btn");
  });
});
