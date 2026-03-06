import "server-only";

import type { UserType } from "@/app/(auth)/auth";
import { getAdminSetting } from "@/lib/db/admin-settings";

export type Entitlements = {
  maxMessagesPerDay: number;
};

const DEFAULT_ENTITLEMENTS: Record<UserType, Entitlements> = {
  guest: { maxMessagesPerDay: 20 },
  regular: { maxMessagesPerDay: 100 },
};

export const entitlementsByUserType = DEFAULT_ENTITLEMENTS;

export async function getEntitlementsForUserType(
  userType: UserType
): Promise<Entitlements> {
  const defaultEntitlements = DEFAULT_ENTITLEMENTS[userType];
  if (!defaultEntitlements) {
    return DEFAULT_ENTITLEMENTS.regular;
  }

  const maxMessagesPerDay = await getAdminSetting(
    `entitlements.${userType}.max_messages_per_day` as "entitlements.guest.max_messages_per_day"
  );

  return {
    maxMessagesPerDay:
      typeof maxMessagesPerDay === "number" && maxMessagesPerDay >= 0
        ? maxMessagesPerDay
        : defaultEntitlements.maxMessagesPerDay,
  };
}
