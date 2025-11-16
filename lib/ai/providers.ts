import { createGatewayProvider, gateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
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
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "film-agent": filmAgentModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": gateway.languageModel("openai/gpt-4o-mini"),
        "film-agent": filmAgentGateway.languageModel("openai/gpt-4o"),
        "title-model": gateway.languageModel("openai/gpt-4o-mini"),
        "artifact-model": gateway.languageModel("openai/gpt-4o-mini"),
      },
    });
