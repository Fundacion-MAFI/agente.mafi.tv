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
    name: "OpenAI GPT-4o mini",
    description: "Modelo multimodal veloz para conversaciones generales.",
  },
  {
    id: "film-agent",
    name: "Agente Fílmico",
    description:
      "Usa RAG sobre el archivo MAFI y OpenAI para generar playlists curatoriales.",
    forcedMode: "archivo",
  },
];
