import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageDropzone } from "../components/ImageDropzone";

vi.mock("../App.css", () => ({}));
vi.mock("../i18n", () => ({
  useT: () => ({ t: (k: string) => k, lang: "es", setLang: vi.fn() }),
  LangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ImageDropzone", () => {
  const baseProps = {
    src: "",
    name: "",
    loadError: false,
    onLoad: vi.fn(),
    onError: vi.fn(),
    onDrop: vi.fn(),
  };

  it("shows placeholder when no media", () => {
    render(<ImageDropzone {...baseProps} />);
    expect(screen.getByText("Arrastra imagen aquí")).toBeInTheDocument();
  });

  it("shows image when media is loaded", () => {
    render(
      <ImageDropzone
        {...baseProps}
        src="file:///test.png"
        name="test.png"
        mediaInfo={{ name: "test.png", width: 1920, height: 1080 }}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "file:///test.png");
  });

  it("shows error message when load fails", () => {
    render(
      <ImageDropzone
        {...baseProps}
        src="file:///broken.png"
        name="broken.png"
        loadError
        mediaInfo={{ name: "broken.png", width: 0, height: 0 }}
      />
    );
    expect(screen.getByText("No se pudo cargar el archivo")).toBeInTheDocument();
  });

  it("shows media info", () => {
    render(
      <ImageDropzone
        {...baseProps}
        mediaInfo={{ name: "photo.jpg", width: 800, height: 600 }}
      />
    );
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText("800×600")).toBeInTheDocument();
  });

  it("shows file size when provided", () => {
    render(
      <ImageDropzone
        {...baseProps}
        mediaInfo={{ name: "photo.jpg", width: 100, height: 100, size: "2.5 MB" }}
      />
    );
    expect(screen.getByText("2.5 MB")).toBeInTheDocument();
  });
});
