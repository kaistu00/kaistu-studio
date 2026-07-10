// Project-wide shared types for KAISTU Studio

export type MediaType = "text" | "image" | "audio" | "video";

export type GenerationStatus = "idle" | "generating" | "done" | "error";

export interface GenerationRequest {
  prompt: string;
  mediaType: MediaType;
  options?: Record<string, unknown>;
}

export interface GenerationResult {
  id: string;
  prompt: string;
  mediaType: MediaType;
  outputUrl?: string;
  status: GenerationStatus;
  error?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  mediaType: MediaType;
  content: GenerationResult[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  language: string;
  projectsDir: string;
  backendUrl: string;
}

// Menu item types for Electron native menu (shared for reference)
export type MenuAction =
  | "new-project"
  | "open-project"
  | "save"
  | "save-as"
  | "export"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "select-all"
  | "preferences"
  | "toggle-dev-tools"
  | "reload"
  | "about";
