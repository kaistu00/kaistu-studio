import { initTRPC } from "@trpc/server";
import { z } from "zod";

/**
 * Shared tRPC router definition.
 * Handlers are injected by the environment (Electron main process or Next.js API route).
 * This file exports the TYPE only — actual implementation is environment-specific.
 */
const t = initTRPC.create();

const GenerationInput = z.object({
  prompt: z.string().min(1).max(10000),
  mediaType: z.enum(["text", "image", "audio", "video"]),
  options: z.record(z.unknown()).optional(),
});

export const appRouter = t.router({
  generate: t.procedure.input(GenerationInput).mutation(({ input }) => {
    throw new Error("Not implemented — handler must be injected by the runtime");
  }),

  health: t.procedure.query(() => {
    return { status: "unknown" as const };
  }),
});

export type AppRouter = typeof appRouter;
