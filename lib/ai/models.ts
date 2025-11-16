import type { MessageMode } from "../types";

export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  forcedMode?: MessageMode;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Grok Vision",
    description: "Advanced multimodal model with vision and text capabilities",
  },
  {
    id: "chat-model-reasoning",
    name: "Grok Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
  {
    id: "film-agent",
    name: "Agente Fílmico",
    description:
      "Recupera planos del archivo MAFI y arma playlists curatoriales.",
    forcedMode: "archivo",
  },
];
