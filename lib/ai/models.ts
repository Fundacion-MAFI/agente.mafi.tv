import type { MessageMode } from "../types";

export const FILM_AGENT_MODEL: string = "film-agent";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
  forcedMode?: MessageMode;
};

export const chatModels: ChatModel[] = [
  {
    id: "film-agent",
    name: "Agente Fílmico",
    description:
      "Usa RAG sobre el archivo MAFI y OpenAI para generar playlists curatoriales.",
    forcedMode: "archivo",
  },
];
