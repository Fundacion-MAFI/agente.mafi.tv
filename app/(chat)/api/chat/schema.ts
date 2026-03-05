import { z } from "zod";

import type { ChatModel } from "@/lib/ai/models";
import { chatModels } from "@/lib/ai/models";

const chatModelIds = chatModels.map((model) => model.id) as [
  ChatModel["id"],
  ...ChatModel["id"][],
];

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
    mode: z.literal("archivo"),
  }),
  selectedChatModel: z.enum(chatModelIds),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
