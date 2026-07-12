import { describe, it, expect, vi } from "vitest";
import { copyToClipboard } from "../utils/clipboard";

describe("copyToClipboard", () => {
  it("calls navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await copyToClipboard("test text");
    expect(writeText).toHaveBeenCalledWith("test text");
  });
});
