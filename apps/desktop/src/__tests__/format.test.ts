import { describe, it, expect } from "vitest";
import { formatFileSize, formatCount, formatParams, formatGB, cpuStatLevel, buildOutputPath } from "../utils/format";

describe("formatFileSize", () => {
  it("returns KB for < 1 MB", () => expect(formatFileSize(0.5)).toBe("500 KB"));
  it("returns MB for < 1000 MB", () => expect(formatFileSize(340.2)).toBe("340.2 MB"));
  it("returns GB for >= 1000 MB", () => expect(formatFileSize(2048)).toBe("2.00 GB"));
});

describe("formatCount", () => {
  it("returns raw number for < 1000", () => expect(formatCount(340)).toBe("340"));
  it("returns K for >= 1000", () => expect(formatCount(1234)).toBe("1.2K"));
  it("returns M for >= 1_000_000", () => expect(formatCount(1_234_567)).toBe("1.2M"));
});

describe("formatParams", () => {
  it("returns empty for null", () => expect(formatParams(null)).toBe(""));
  it("returns B for >= 1B", () => expect(formatParams(1_200_000_000)).toBe("1.2B"));
  it("returns M for >= 1M", () => expect(formatParams(340_000_000)).toBe("340M"));
});

describe("formatGB", () => {
  it("returns ? for 0", () => expect(formatGB(0)).toBe("?"));
  it("returns GB value", () => expect(formatGB(2048)).toBe("2.0"));
});

describe("cpuStatLevel", () => {
  it("returns green for < 35", () => expect(cpuStatLevel(20)).toBe("green"));
  it("returns yellow for < 70", () => expect(cpuStatLevel(50)).toBe("yellow"));
  it("returns red for >= 70", () => expect(cpuStatLevel(80)).toBe("red"));
});

describe("buildOutputPath", () => {
  it("builds path with png extension", () => {
    const result = buildOutputPath("C:\\out", "photo.png", 4, "png");
    expect(result).toBe("C:/out/photo_x4.png");
  });

  it("builds path with jpg extension", () => {
    const result = buildOutputPath("C:\\out", "photo.png", 2, "jpg");
    expect(result).toBe("C:/out/photo_x2.jpg");
  });

  it("builds path with webp extension", () => {
    const result = buildOutputPath("C:\\out", "photo.png", 4, "webp");
    expect(result).toBe("C:/out/photo_x4.webp");
  });

  it("builds path with mp4 extension", () => {
    const result = buildOutputPath("C:\\out", "video.mp4", 2, "mp4");
    expect(result).toBe("C:/out/video_x2.mp4");
  });

  it("defaults to png for unknown format", () => {
    const result = buildOutputPath("C:\\out", "photo.png", 3, "bmp");
    expect(result).toBe("C:/out/photo_x3.png");
  });

  it("normalizes backslashes to forward slashes", () => {
    const result = buildOutputPath("C:\\users\\test\\out", "img.png", 2, "png");
    expect(result).toBe("C:/users/test/out/img_x2.png");
  });
});
