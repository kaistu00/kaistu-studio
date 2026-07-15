import { describe, it, expect } from "vitest";
import { withCivitaiRef, CIVITAI_REF_CODE } from "../utils/civitai";

describe("CIVITAI_REF_CODE", () => {
  it("is the expected referral code", () => {
    expect(CIVITAI_REF_CODE).toBe("ATNFQ4QL");
  });
});

describe("withCivitaiRef", () => {
  it("adds ref_code to a path", () => {
    const result = withCivitaiRef("/models/123");
    expect(result).toBe(`https://civitai.com/models/123?ref_code=${CIVITAI_REF_CODE}`);
  });

  it("adds ref_code to a full URL", () => {
    const result = withCivitaiRef("https://civitai.com/models/456");
    expect(result).toBe(`https://civitai.com/models/456?ref_code=${CIVITAI_REF_CODE}`);
  });

  it("uses civitai.red domain for NSFW mode", () => {
    const result = withCivitaiRef("/models/789", "nsfw");
    expect(result).toBe(`https://civitai.red/models/789?ref_code=${CIVITAI_REF_CODE}`);
  });

  it("handles URLs with existing query params", () => {
    const result = withCivitaiRef("/models/123?existing=true");
    expect(result).toBe(`https://civitai.com/models/123?existing=true&ref_code=${CIVITAI_REF_CODE}`);
  });

  it("handles empty input", () => {
    const result = withCivitaiRef("");
    expect(result).toBe(`https://civitai.com/?ref_code=${CIVITAI_REF_CODE}`);
  });
});
