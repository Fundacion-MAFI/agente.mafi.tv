import { eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { adminSettings } from "@/lib/db/schema/admin-settings";

export type AdminSettingKey =
  | "prompts.agente_filmico"
  | "prompts.regular"
  | "prompts.artifacts"
  | "prompts.code"
  | "prompts.sheet"
  | "prompts.title"
  | "prompts.update_document"
  | "embedding.model"
  | "embedding.chunk_size"
  | "embedding.chunk_overlap"
  | "retrieval.k"
  | "retrieval.max_result_limit"
  | "retrieval.cache_ttl_ms"
  | "retrieval.cache_max_entries"
  | "chat.model"
  | "chat.step_count"
  | "entitlements.guest.max_messages_per_day"
  | "entitlements.regular.max_messages_per_day"
  | "ingest.throttle_enabled"
  | "ingest.throttle_delay_ms";

export type AdminSettingsMap = Partial<
  Record<AdminSettingKey, string | number | boolean | string[]>
>;

const DEFAULTS: Record<AdminSettingKey, string | number | boolean | string[]> =
  {
    "prompts.agente_filmico": "",
    "prompts.regular": "",
    "prompts.artifacts": "",
    "prompts.code": "",
    "prompts.sheet": "",
    "prompts.title": "",
    "prompts.update_document": "",
    "embedding.model": "openai/text-embedding-3-small",
    "embedding.chunk_size": 800,
    "embedding.chunk_overlap": 200,
    "retrieval.k": 24,
    "retrieval.max_result_limit": 50,
    "retrieval.cache_ttl_ms": 300_000,
    "retrieval.cache_max_entries": 128,
    "chat.model": "openai/gpt-5.2",
    "chat.step_count": 5,
    "entitlements.guest.max_messages_per_day": 20,
    "entitlements.regular.max_messages_per_day": 100,
    "ingest.throttle_enabled": true,
    "ingest.throttle_delay_ms": 10_000,
  };

export async function getAdminSetting<K extends AdminSettingKey>(
  key: K
): Promise<AdminSettingsMap[K]> {
  const [row] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, key))
    .limit(1);

  if (!row) {
    return DEFAULTS[key] as AdminSettingsMap[K];
  }

  const raw = row.value as unknown;
  if (raw === null || raw === undefined) {
    return DEFAULTS[key] as AdminSettingsMap[K];
  }

  return raw as AdminSettingsMap[K];
}

export async function getAdminSettings(): Promise<AdminSettingsMap> {
  const rows = await db.select().from(adminSettings);

  const result: AdminSettingsMap = { ...DEFAULTS };

  for (const row of rows) {
    const key = row.key as AdminSettingKey;
    if (key in DEFAULTS && row.value != null) {
      result[key] = row.value as AdminSettingsMap[AdminSettingKey];
    }
  }

  return result;
}

export async function setAdminSetting<K extends AdminSettingKey>(
  key: K,
  value: AdminSettingsMap[K]
): Promise<void> {
  await db
    .insert(adminSettings)
    .values({
      key,
      value: value as string | number | boolean | string[] | object,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminSettings.key,
      set: {
        value: value as string | number | boolean | string[] | object,
        updatedAt: new Date(),
      },
    });
}

export async function setAdminSettings(
  updates: AdminSettingsMap
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    await db
      .insert(adminSettings)
      .values({
        key,
        value: value as string | number | boolean | string[] | object,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: adminSettings.key,
        set: {
          value: value as string | number | boolean | string[] | object,
          updatedAt: new Date(),
        },
      });
  }
}

export { DEFAULTS };
