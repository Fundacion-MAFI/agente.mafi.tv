import { z } from "zod";

export const mafiPlaylistDocumentEntrySchema = z.object({
  order: z.number().int().positive().optional(),
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  reason: z.string().min(1),
  supportingDetail: z.string().optional(),
  shotId: z.string().uuid().optional(),
  author: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  place: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  excerpt: z.string().nullable().optional(),
  vimeoUrl: z.string().nullable().optional(),
  vimeoId: z.string().nullable().optional(),
  startTimeSeconds: z.number().nullable().optional(),
  startTimeLabel: z.string().nullable().optional(),
});

export const mafiPlaylistDocumentSchema = z.object({
  question: z.string().min(1),
  generalComment: z.string().min(1),
  playlist: z.array(mafiPlaylistDocumentEntrySchema),
});

export type MafiPlaylistDocumentEntry = z.infer<
  typeof mafiPlaylistDocumentEntrySchema
>;
export type MafiPlaylistDocumentContent = z.infer<
  typeof mafiPlaylistDocumentSchema
>;

export function safeParseMafiPlaylistDocument(
  content: string
): MafiPlaylistDocumentContent | null {
  try {
    const json = JSON.parse(content);
    const result = mafiPlaylistDocumentSchema.safeParse(json);

    if (!result.success) {
      return null;
    }

    return result.data;
  } catch (_error) {
    return null;
  }
}
