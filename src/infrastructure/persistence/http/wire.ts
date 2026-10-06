import { z } from "zod";

export const WireErrorSchema = z.object({
  code: z.enum(["NOT_FOUND", "ALREADY_EXISTS", "INVALID_WORLD", "STORAGE"]),
  message: z.string(),
});
export type WireError = z.infer<typeof WireErrorSchema>;

export const STATUS_BY_CODE: Record<WireError["code"], number> = {
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  INVALID_WORLD: 422,
  STORAGE: 500,
};

export const WorldSummaryListSchema = z.array(
  z.object({ id: z.string(), name: z.string(), updatedAt: z.string() }),
);
