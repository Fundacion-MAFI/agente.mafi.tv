import { z } from "zod";

export const mafiAnswerSchema = z.object({
  generalComment: z
    .string()
    .describe(
      "Respuesta ensayística breve (1–3 párrafos) que articula la pregunta del usuario con el archivo MAFI."
    ),
  shots: z
    .array(
      z.object({
        id: z.string().describe("ID de la toma, tomado del contexto."),
        slug: z.string(),
        title: z.string(),
        vimeoUrl: z.string().url(),
        recommendedStartSeconds: z.number().int().min(0).optional(),
        recommendedEndSeconds: z.number().int().min(0).optional(),
        reason: z
          .string()
          .describe(
            "Por qué esta toma dialoga con la pregunta; 2–4 frases, sin repetir el generalComment."
          ),
        tags: z.array(z.string()).optional(),
      })
    )
    .min(2)
    .max(5),
  followUpSuggestions: z
    .array(
      z
        .string()
        .describe("Preguntas o recorridos que amplíen la investigación."),
    )
    .min(1)
    .max(4),
});

export type MafiAnswer = z.infer<typeof mafiAnswerSchema>;
