import { createGatewayProvider, gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const shouldUseCustomFilmAgentGateway =
  Boolean(process.env.AI_GATEWAY_FILM_AGENT_BASE_URL) ||
  Boolean(process.env.AI_GATEWAY_FILM_AGENT_API_KEY);

const filmAgentGateway = shouldUseCustomFilmAgentGateway
  ? createGatewayProvider({
      baseURL: process.env.AI_GATEWAY_FILM_AGENT_BASE_URL || undefined,
      apiKey: process.env.AI_GATEWAY_FILM_AGENT_API_KEY || undefined,
    })
  : gateway;

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        filmAgentModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "film-agent": filmAgentModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
        "film-agent": filmAgentGateway.languageModel("xai/grok-2-vision-1212"),
        "chat-model-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": gateway.languageModel("xai/grok-2-1212"),
        "artifact-model": gateway.languageModel("xai/grok-2-1212"),
      },
    });
