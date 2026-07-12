export const CIVITAI_REF_CODE = "ATNFQ4QL";

export type CivitaiMode = "sfw" | "nsfw";

export function withCivitaiRef(input: string, mode: CivitaiMode = "sfw"): string {
  const raw = input ?? "";
  let url: string;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else {
    const domain = mode === "nsfw" ? "civitai.red" : "civitai.com";
    url = `https://${domain}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ref_code=${CIVITAI_REF_CODE}`;
}
