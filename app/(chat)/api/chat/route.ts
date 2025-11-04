import { z } from "zod";
import { getShotIndex } from "@/lib/mafi/corpus";
import type { ShotRecommendation } from "@/lib/mafi/types";

const OPENAI_MODEL = process.env.MAFI_OPENAI_MODEL ?? "gpt-4.1-mini";
const VECTOR_STORE_ID = process.env.MAFI_VECTOR_STORE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

const shotSchema = z.object({
  id: z.string(),
  dir: z.string().optional(),
  shotTitle: z.string().optional(),
  vimeoId: z.string().optional(),
  imageSrc: z.string().optional(),
  reason: z.string().optional(),
});

const responseSchema = z.object({
  answer: z.string(),
  shots: z.array(shotSchema).default([]),
});

const buildSystemPrompt = () => `You are an assistant that answers questions about the MAFI video archive. Always search the attached corpus using the file_search tool before answering. For every user question, return both a natural-language answer in the \"answer\" field and a list of relevant shots in the \"shots\" array.

Use the metadata fields in the markdown files as follows:
- \"name\" becomes dir.
- \"stage_name\" becomes shotTitle.
- \"genre\" becomes id.
- image.src becomes imageSrc.
- image.alt becomes vimeoId.

Only reference id values that exist in the corpus. If no shot is clearly relevant you may return an empty shots array but still fill answer.

Each shot must include a short reason explaining its relevance in the reason field.`;

const structuredResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "mafi_response",
    schema: {
      type: "object",
      required: ["answer", "shots"],
      properties: {
        answer: { type: "string" },
        shots: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "reason"],
            properties: {
              id: { type: "string" },
              dir: { type: "string" },
              shotTitle: { type: "string" },
              vimeoId: { type: "string" },
              imageSrc: { type: "string" },
              reason: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
};

const buildOpenAIMessages = (messages: Array<{ role: "user" | "assistant"; content: string }>) => {
  const history = messages.map((message) => ({
    role: message.role,
    content: [
      {
        type: "text" as const,
        text: message.content,
      },
    ],
  }));

  return [
    {
      role: "system",
      content: [
        {
          type: "text" as const,
          text: buildSystemPrompt(),
        },
      ],
    },
    ...history,
  ];
};

const extractStructuredObject = (payload: any) => {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload.output)) {
    for (const output of payload.output) {
      if (!output?.content) {
        continue;
      }

      for (const item of output.content) {
        if (item.type === "json_schema" && item.json) {
          return item.json;
        }

        if (item.type === "output_text" && typeof item.text === "string") {
          try {
            return JSON.parse(item.text);
          } catch (error) {
            console.warn("Failed to parse output_text as JSON", error);
          }
        }
      }
    }
  }

  if (typeof payload.output_text === "string") {
    try {
      return JSON.parse(payload.output_text);
    } catch (error) {
      console.warn("Failed to parse output_text fallback", error);
    }
  }

  return null;
};

const fetchOpenAIResponse = async (body: unknown) => {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!VECTOR_STORE_ID) {
    throw new Error("MAFI_VECTOR_STORE_ID is not configured");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  return response.json();
};

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { messages } = parsed.data;
    const openAIMessages = buildOpenAIMessages(messages);
    const requestBody = {
      model: OPENAI_MODEL,
      input: openAIMessages,
      response_format: structuredResponseFormat,
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [VECTOR_STORE_ID],
        },
      },
    };

    const payload = await fetchOpenAIResponse(requestBody);
    const structured = extractStructuredObject(payload);
    const validated = responseSchema.safeParse(structured);

    if (!validated.success) {
      console.error("Failed to validate structured output", structured);
      return Response.json(
        { error: "Unable to parse model response" },
        { status: 502 }
      );
    }

    const { shots: rawShots, answer } = validated.data;
    const { byId } = await getShotIndex();

    const shots: ShotRecommendation[] = rawShots
      .map((shot) => {
        const canonical = byId.get(shot.id);

        if (!canonical) {
          return null;
        }

        return {
          ...canonical,
          dir: shot.dir?.trim() || canonical.dir,
          shotTitle: shot.shotTitle?.trim() || canonical.shotTitle,
          imageSrc: shot.imageSrc?.trim() || canonical.imageSrc,
          vimeoId: shot.vimeoId?.trim() || canonical.vimeoId,
          reason: shot.reason?.trim() || "",
        } satisfies ShotRecommendation;
      })
      .filter((shot): shot is ShotRecommendation => Boolean(shot));

    return Response.json({ answer, shots });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Unable to process request" },
      { status: 500 }
    );
  }
}
