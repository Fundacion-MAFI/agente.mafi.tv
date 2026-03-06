import { NextResponse } from "next/server";
import { isEmbeddingModelId } from "@/lib/ai/embedding-models";
import {
  AGENTE_FILMICO_SYSTEM_PROMPT,
  artifactsPrompt,
  codePrompt,
  regularPrompt,
  sheetPrompt,
  titlePrompt,
} from "@/lib/ai/prompts";
import { requireAdmin } from "@/lib/auth/admin";
import {
  type AdminSettingKey,
  type AdminSettingsMap,
  DEFAULTS,
  getAdminSettings,
  setAdminSettings,
} from "@/lib/db/admin-settings";

const PROMPT_DEFAULTS: Partial<AdminSettingsMap> = {
  "prompts.agente_filmico": AGENTE_FILMICO_SYSTEM_PROMPT,
  "prompts.regular": regularPrompt,
  "prompts.artifacts": artifactsPrompt,
  "prompts.code": codePrompt,
  "prompts.sheet": sheetPrompt,
  "prompts.title": titlePrompt,
  "prompts.update_document":
    "Improve the following contents of the {mediaType} based on the given prompt.\n\n{currentContent}",
};

function withPromptDefaults(settings: AdminSettingsMap): AdminSettingsMap {
  const result = { ...settings };
  for (const [key, defaultVal] of Object.entries(PROMPT_DEFAULTS)) {
    const val = result[key as AdminSettingKey];
    if (
      (val === "" || val === undefined || val === null) &&
      typeof defaultVal === "string"
    ) {
      result[key as AdminSettingKey] = defaultVal;
    }
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const settings = await getAdminSettings();
    const withDefaults = withPromptDefaults(settings);
    return NextResponse.json({
      settings: withDefaults,
      defaults: { ...DEFAULTS, ...PROMPT_DEFAULTS },
    });
  } catch (error) {
    console.error("Admin get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

const ALLOWED_KEYS: AdminSettingKey[] = [
  "prompts.agente_filmico",
  "prompts.regular",
  "prompts.artifacts",
  "prompts.code",
  "prompts.sheet",
  "prompts.title",
  "prompts.update_document",
  "embedding.model",
  "embedding.chunk_size",
  "embedding.chunk_overlap",
  "retrieval.k",
  "retrieval.max_result_limit",
  "retrieval.cache_ttl_ms",
  "retrieval.cache_max_entries",
  "chat.step_count",
  "entitlements.guest.max_messages_per_day",
  "entitlements.guest.available_chat_model_ids",
  "entitlements.regular.max_messages_per_day",
  "entitlements.regular.available_chat_model_ids",
  "ingest.throttle_enabled",
  "ingest.throttle_delay_ms",
];

function parseValue(
  key: AdminSettingKey,
  raw: unknown
): string | number | boolean | string[] | undefined {
  if (raw === null || raw === undefined) return;

  if (key.startsWith("prompts.")) {
    return typeof raw === "string" ? raw : String(raw);
  }

  if (key === "embedding.model") {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed.length > 0 && isEmbeddingModelId(trimmed)
      ? trimmed
      : undefined;
  }

  if (
    key.includes("available_chat_model_ids") ||
    key === "entitlements.guest.available_chat_model_ids" ||
    key === "entitlements.regular.available_chat_model_ids"
  ) {
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === "string");
    }
    if (typeof raw === "string") {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return;
  }

  if (
    key.includes("chunk_size") ||
    key.includes("chunk_overlap") ||
    key.includes("cache_ttl_ms") ||
    key.includes("cache_max_entries") ||
    key.includes("max_result_limit") ||
    key.includes("step_count") ||
    key.includes("max_messages_per_day") ||
    key.includes("throttle_delay_ms")
  ) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  if (key.includes("throttle_enabled")) {
    if (typeof raw === "boolean") return raw;
    if (raw === "1" || raw === "true" || raw === "yes") return true;
    if (raw === "0" || raw === "false" || raw === "no") return false;
    return;
  }

  return;
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: AdminSettingsMap = {};

    for (const key of ALLOWED_KEYS) {
      const raw = body[key];
      if (raw === undefined) continue;

      const parsed = parseValue(key, raw);
      if (parsed !== undefined) {
        updates[key] = parsed;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    await setAdminSettings(updates);
    return NextResponse.json({
      ok: true,
      updated: Object.keys(updates).length,
    });
  } catch (error) {
    console.error("Admin patch settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
