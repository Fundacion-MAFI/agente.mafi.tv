"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import type { ChatMessage } from "@/lib/types";
import type { UiSettings } from "@/app/(chat)/api/ui-settings/route";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

const MOBILE_BREAKPOINT = 768;

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const { width } = useWindowSize();
  const [suggestedActionsConfig, setSuggestedActionsConfig] = useState<
    UiSettings["suggestedActions"] | null
  >(null);

  useEffect(() => {
    fetch("/api/ui-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UiSettings | null) => {
        if (data?.suggestedActions) {
          setSuggestedActionsConfig(data.suggestedActions);
        } else {
          setSuggestedActionsConfig({
            items: [],
            visibleCountMobile: 4,
            visibleCountWeb: 6,
          });
        }
      })
      .catch(() => {
        setSuggestedActionsConfig({
          items: [],
          visibleCountMobile: 4,
          visibleCountWeb: 6,
        });
      });
  }, []);

  const visibleActions = useMemo(() => {
    if (!suggestedActionsConfig?.items.length) return [];
    const isMobile = width !== undefined && width < MOBILE_BREAKPOINT;
    const limit = isMobile
      ? suggestedActionsConfig.visibleCountMobile
      : suggestedActionsConfig.visibleCountWeb;
    return suggestedActionsConfig.items
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .slice(0, Math.max(0, limit));
  }, [suggestedActionsConfig, width]);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {visibleActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={`${suggestedAction}-${index}`}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal p-3 text-left"
            onClick={(suggestion) => {
              window.history.replaceState({}, "", `/chat/${chatId}`);
              sendMessage({
                role: "user",
                mode: "archivo",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
