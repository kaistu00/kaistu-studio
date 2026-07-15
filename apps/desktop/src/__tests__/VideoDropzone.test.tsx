import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoDropzone, formatDuration } from "../components/VideoDropzone";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("formatDuration", () => {
  it("returns m:s for < 1 hour", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("returns h:m:s for >= 1 hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("pads seconds with zero", () => {
    expect(formatDuration(63)).toBe("1:03");
  });

  it("handles 0 seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("VideoDropzone", () => {
  const baseProps = {
    src: "",
    name: "",
    loadError: false,
    onLoad: vi.fn(),
    onError: vi.fn(),
    onDrop: vi.fn(),
  };

  it("shows placeholder when no media", () => {
    render(<VideoDropzone {...baseProps} mediaInfo={{ name: "", width: 0, height: 0 }} />);
    expect(screen.getByText("Arrastra video aquí")).toBeInTheDocument();
  });

  it("shows video when media is loaded", () => {
    render(
      <VideoDropzone
        {...baseProps}
        src="file:///test.mp4"
        name="test.mp4"
        mediaInfo={{ name: "test.mp4", width: 1920, height: 1080 }}
      />
    );
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "file:///test.mp4");
  });

  it("shows error when load fails", () => {
    render(
      <VideoDropzone
        {...baseProps}
        src="file:///broken.mp4"
        name="broken.mp4"
        loadError
        mediaInfo={{ name: "broken.mp4", width: 0, height: 0 }}
      />
    );
    expect(screen.getByText("No se pudo cargar el archivo")).toBeInTheDocument();
  });

  it("shows media info", () => {
    render(
      <VideoDropzone
        {...baseProps}
        mediaInfo={{ name: "video.mp4", width: 1920, height: 1080, size: "50 MB", duration: "2:30" }}
      />
    );
    expect(screen.getByText("video.mp4")).toBeInTheDocument();
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("50 MB")).toBeInTheDocument();
    expect(screen.getByText("2:30")).toBeInTheDocument();
  });
});
