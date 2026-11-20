import "server-only";
import { z } from "zod";

// What a phone may send to the favourites sync (validated on the server only, so zod
// never ships in the Quick Talk bundle).
export const favSnapshotSchema = z
  .array(
    z.object({
      phraseId: z.string().regex(/^[a-z0-9-]{1,40}$/),
      deleted: z.boolean(),
      updatedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    }),
  )
  .max(500);
