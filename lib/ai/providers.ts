import { createGatewayProvider, gateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

const openaiBaseURL = process.env.OPENAI_BASE_URL?.trim();

const openaiProvider = openaiBaseURL
  ? createOpenAI({
      baseURL: openaiBaseURL,
      apiKey: process.env.OPENAI_API_KEY?.trim(),
    })
  : null;

const GROK_HOST_PATTERN = /(?:grok|x\.ai)/i;

function resolveFilmAgentGateway() {
  const baseURL = process.env.AI_GATEWAY_FILM_AGENT_BASE_URL?.trim();
  const apiKey = process.env.AI_GATEWAY_FILM_AGENT_API_KEY?.trim();

  if (baseURL && GROK_HOST_PATTERN.test(baseURL)) {
    console.warn(
      "Agente Fílmico ignores Grok/xAI endpoints. Falling back to the OpenAI-powered AI Gateway."
    );
    return gateway;
  }

  if ((baseURL && !apiKey) || (!baseURL && apiKey)) {
    console.warn(
      "Both AI_GATEWAY_FILM_AGENT_BASE_URL and AI_GATEWAY_FILM_AGENT_API_KEY must be set to override the Archivo gateway. Falling back to the default OpenAI gateway."
    );
    return gateway;
  }

  if (baseURL && apiKey) {
    try {
      // Validate the URL early so deploys fail fast with a helpful warning.
      new URL(baseURL);
    } catch {
      console.warn(
        "AI_GATEWAY_FILM_AGENT_BASE_URL is not a valid URL. Falling back to the default OpenAI gateway."
      );
      return gateway;
    }

    return createGatewayProvider({
      baseURL,
      apiKey,
    });
  }

  return gateway;
}

export const filmAgentGateway = resolveFilmAgentGateway();

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
        "chat-model": openaiProvider
          ? openaiProvider("gpt-4o-mini")
          : gateway.languageModel("openai/gpt-4o-mini"),
        "film-agent": filmAgentGateway.languageModel("openai/gpt-4o"),
        "title-model": openaiProvider
          ? openaiProvider("gpt-4o-mini")
          : gateway.languageModel("openai/gpt-4o-mini"),
        "artifact-model": openaiProvider
          ? openaiProvider("gpt-4o-mini")
          : gateway.languageModel("openai/gpt-4o-mini"),
      },
    });
