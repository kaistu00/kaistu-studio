import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompareSlider } from "../components/CompareSlider";

vi.mock("../App.css", () => ({}));

describe("CompareSlider", () => {
  const before = "C:\\imgs\\original.png";
  const after = "C:\\imgs\\upscaled.png";

  it("renders before and after images", () => {
    render(<CompareSlider beforePath={before} afterPath={after} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("alt", "original");
    expect(imgs[1]).toHaveAttribute("alt", "escalado");
  });

  it("renders labels", () => {
    render(<CompareSlider beforePath={before} afterPath={after} />);
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Escalado")).toBeInTheDocument();
  });

  it("renders handle knob", () => {
    render(<CompareSlider beforePath={before} afterPath={after} />);
    expect(screen.getByText("◀▶")).toBeInTheDocument();
  });

  it("renders video elements when isVideo is true", () => {
    render(<CompareSlider beforePath={before} afterPath={after} isVideo />);
    const videos = document.querySelectorAll("video");
    expect(videos).toHaveLength(2);
  });

  it("converts Windows paths to local-file:// URLs", () => {
    render(<CompareSlider beforePath="C:\\users\\test\\img.png" afterPath={after} />);
    const imgs = screen.getAllByRole("img") as HTMLImageElement[];
    expect(imgs[0].src).toMatch(/^local-file:\/\/\//);
    expect(imgs[0].src).toContain("C:");
    expect(imgs[0].src).toContain("img.png");
  });
});
