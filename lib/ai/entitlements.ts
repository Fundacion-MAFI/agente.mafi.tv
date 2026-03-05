import "server-only";

import type { UserType } from "@/app/(auth)/auth";
import { getAdminSetting } from "@/lib/db/admin-settings";
import type { ChatModel } from "./models";

export type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

const DEFAULT_ENTITLEMENTS: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: ["chat-model", "film-agent"],
  },
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ["chat-model", "film-agent"],
  },
};

export const entitlementsByUserType = DEFAULT_ENTITLEMENTS;

export async function getEntitlementsForUserType(
  userType: UserType
): Promise<Entitlements> {
  const defaultEntitlements = DEFAULT_ENTITLEMENTS[userType];
  if (!defaultEntitlements) {
    return DEFAULT_ENTITLEMENTS.regular;
  }

  const [maxMessagesPerDay, availableChatModelIds] = await Promise.all([
    getAdminSetting(
      `entitlements.${userType}.max_messages_per_day` as "entitlements.guest.max_messages_per_day"
    ),
    getAdminSetting(
      `entitlements.${userType}.available_chat_model_ids` as "entitlements.guest.available_chat_model_ids"
    ),
  ]);

  return {
    maxMessagesPerDay:
      typeof maxMessagesPerDay === "number" && maxMessagesPerDay >= 0
        ? maxMessagesPerDay
        : defaultEntitlements.maxMessagesPerDay,
    availableChatModelIds:
      Array.isArray(availableChatModelIds) && availableChatModelIds.length > 0
        ? availableChatModelIds
        : defaultEntitlements.availableChatModelIds,
  };
}
