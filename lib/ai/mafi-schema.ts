import { z } from "zod";

export const mafiPlaylistEntrySchema = z.object({
  shotId: z.string().uuid().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  supportingDetail: z.string().optional(),
});

export const mafiAnswerSchema = z.object({
  generalComment: z.string().min(1),
  playlist: z.array(mafiPlaylistEntrySchema).min(0).max(5),
});

export type MafiAnswer = z.infer<typeof mafiAnswerSchema>;
export type MafiPlaylistEntry = z.infer<typeof mafiPlaylistEntrySchema>;
