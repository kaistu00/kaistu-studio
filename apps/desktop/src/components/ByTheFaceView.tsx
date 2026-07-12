import { useState, useRef, useEffect } from "react";
import { useT } from "../i18n";
import { Breadcrumb } from "./Breadcrumb";
import type { Crumb } from "./Breadcrumb";

interface Space {
  id: string;
  name: string;
  apiUrl: string;
  reliability?: string;
  inputSchema: Array<{ name: string; type: "image" | "text" | string }>;
}

const SPACES: Space[] = [
  {
    id: "qwen-image-edit",
    name: "Qwen Image Edit 2511 (high failure rate)",
    apiUrl: "Qwen/Qwen-Image-Edit-2511",
    inputSchema: [
      { name: "image", type: "image" },
      { name: "prompt", type: "text" },
    ],
  },
  {
    id: "realistic-vision",
    name: "Realistic Vision Edit",
    apiUrl: "Public-Admin/realistic-vision-v51",
    inputSchema: [
      { name: "image", type: "image" },
      { name: "prompt", type: "text" },
    ],
  },
];

export function ByTheFaceView() {
  const { t } = useT();
  const [hasHFKey, setHasHFKey] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<string>("");
  const [spaceReliability, setSpaceReliability] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [resultImage, setResultImage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const crumbs: Crumb[] = [{ label: t("By The Face") }];
  const selectedSpaceData = SPACES.find(s => s.id === selectedSpace);

  useEffect(() => {
    window.electronAPI?.getAPIKeys?.().then((keys) => {
      setHasHFKey(keys.some((k) => k.service === "huggingface"));
    }).catch(() => {});
  }, []);

  if (!hasHFKey) {
    return (
      <div className="settings-view">
        <div className="settings-content">
          <Breadcrumb crumbs={crumbs} onNavigate={() => {}} />
          <div style={{ padding: "24px" }}>
            <div style={{
              padding: "20px",
              background: "color-mix(in srgb, var(--warning) 15%, transparent)",
              border: "1px solid var(--warning)",
              borderRadius: "8px",
              maxWidth: "500px"
            }}>
              <h3 style={{ marginTop: 0 }}>{t("Conecta tu API de Huggingface")}</h3>
              <p>{t("Para usar ByTheFace necesitas conectar tu API Key de HuggingFace.")}</p>
              <IconButton icon="settings" label={t("Ir a Configuración → Herramientas")} onClick={() => window.electronAPI?.showRootMenu?.()} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !prompt) return;
    setLoading(true);
    setError("");
    try {
      const space = SPACES.find(s => s.id === selectedSpace);
      if (!space) throw new Error("No space selected");

      // Convert image to base64
      let imageBase64 = "";
      if (imagePreview) {
        imageBase64 = imagePreview.split(",")[1] || imagePreview;
      }

      const result = await window.electronAPI?.runSpace(space.apiUrl, { image: imageBase64, prompt });
      if (result?.type === "image" && result?.data) {
        setResultImage(`data:image/png;base64,${result.data}`);
      } else if (result?.type === "error") {
        setError(result.message || "Failed to generate");
      } else {
        setResultImage(imagePreview);
      }
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-content">
        <Breadcrumb crumbs={crumbs} onNavigate={() => {}} />
        <div style={{ padding: "24px" }}>
          <div className="civitai-setup-banner" style={{ marginBottom: "20px" }}>
            <span className="material-symbols-outlined">info</span>
            <span>{t("Uses free HuggingFace Spaces APIs - may be slow or fail occasionally, but it's free!")}</span>
          </div>

          <div className="gen-type-selector" style={{ maxWidth: "400px", marginBottom: "24px" }}>
            <label className="gen-type-label">{t("Select Space API")}</label>
            <select
              className="gen-type-dropdown"
              value={selectedSpace}
              onChange={async (e) => {
                const val = e.target.value;
                setSelectedSpace(val);
                setImageFile(null);
                setImagePreview("");
                setPrompt("");
                setResultImage("");
                setError("");
                if (val) {
                  const space = SPACES.find(s => s.id === val);
                  if (space?.apiUrl) {
                    try {
                      const info = await window.electronAPI?.getSpaceInfo(space.apiUrl);
                      setSpaceReliability(info?.reliability || "");
                    } catch {
                      setSpaceReliability("unknown");
                    }
                  }
                }
              }}
            >
              <option value="">{t("Select a Space...")}</option>
              {SPACES.map(space => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </div>

          {selectedSpace && (
            <div className="settings-content-inner">
              <h3 style={{ marginBottom: "16px" }}>{selectedSpaceData?.name}</h3>

              {spaceReliability && (
                <div style={{ 
                  padding: "12px",
                  background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                  border: "1px solid var(--warning)",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  color: "var(--warning)",
                  fontSize: "13px"
                }}>
                  {t("Reliability")}: {spaceReliability}
                </div>
              )}

              {error && (
                <div style={{ 
                  padding: "12px", 
                  background: "color-mix(in srgb, var(--error) 15%, transparent)",
                  border: "1px solid var(--error)",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  color: "var(--error)",
                  fontSize: "13px"
                }}>
                  {error}
                </div>
              )}

              {/* Image upload */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {t("Image to edit")}
                </label>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      const input = fileInputRef.current;
                      if (input) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        input.files = dt.files;
                        handleImageUpload({ target: { files: dt.files } } as any);
                      }
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--border)",
                    borderRadius: "8px",
                    padding: "20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: imagePreview ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                    minHeight: imagePreview ? "200px" : "80px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "180px", borderRadius: "4px" }} />
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>
                      {t("Click or drag image here")}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                />
              </div>

              {/* Prompt */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  {t("Edit instruction")}
                </label>
                <textarea
                  className="text-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t("Describe the modification...")}
                  rows={3}
                  style={{ width: "100%", maxWidth: "400px" }}
                />
              </div>

              {/* Submit */}
              <button className="gen-btn" onClick={handleSubmit} disabled={loading || !imageFile || !prompt}>
                {loading ? t("Generating...") : t("Edit Image")}
              </button>

              {/* Result compare */}
              {resultImage && (
                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{t("Compare:")}</span>
                    <label className="civitai-mode-switch">
                      <input type="checkbox" checked={comparing} onChange={(e) => setComparing(e.target.checked)} />
                      <span className="civitai-mode-track"><span className="civitai-mode-thumb"></span></span>
                    </label>
                  </div>

                  <div style={{ position: "relative", height: "240px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <img
                      src={resultImage}
                      alt="Original"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        clipPath: comparing ? "inset(0 50% 0 0)" : "none",
                      }}
                    />
                    <img
                      src={resultImage}
                      alt="Edited"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        clipPath: "inset(0 0 0 50%)",
                      }}
                    />
                    {comparing && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          width: "2px",
                          backgroundColor: "var(--accent)",
                          left: "50%",
                          transform: "translateX(-50%)",
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}