import { NextResponse } from "next/server";
import {
  getAdminSetting,
  type AdminSettingKey,
} from "@/lib/db/admin-settings";

export type UiSettings = {
  greeting: {
    title: string;
    subtitle: string;
  };
  suggestedActions: {
    items: string[];
    visibleCountMobile: number;
    visibleCountWeb: number;
  };
};

export async function GET() {
  try {
    const [title, subtitle, items, visibleCountMobile, visibleCountWeb] =
      await Promise.all([
        getAdminSetting("greeting.title" as AdminSettingKey),
        getAdminSetting("greeting.subtitle" as AdminSettingKey),
        getAdminSetting("suggested_actions.items" as AdminSettingKey),
        getAdminSetting("suggested_actions.visible_count_mobile" as AdminSettingKey),
        getAdminSetting("suggested_actions.visible_count_web" as AdminSettingKey),
      ]);

    const settings: UiSettings = {
      greeting: {
        title: typeof title === "string" ? title : "",
        subtitle: typeof subtitle === "string" ? subtitle : "",
      },
      suggestedActions: {
        items: Array.isArray(items)
          ? items.filter((v): v is string => typeof v === "string")
          : [],
        visibleCountMobile:
          typeof visibleCountMobile === "number" && visibleCountMobile >= 0
            ? visibleCountMobile
            : 4,
        visibleCountWeb:
          typeof visibleCountWeb === "number" && visibleCountWeb >= 0
            ? visibleCountWeb
            : 6,
      },
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("UI settings error:", error);
    return NextResponse.json(
      { error: "Failed to get UI settings" },
      { status: 500 }
    );
  }
}
