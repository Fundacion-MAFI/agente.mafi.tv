export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: "log",
  chat: "response",
  auth: "response",
  stream: "response",
  api: "response",
  history: "response",
  vote: "response",
  document: "response",
  suggestions: "response",
  activate_gateway: "response",
};

export class ChatSDKError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: "", message: "Algo salió mal. Por favor, inténtalo de nuevo más tarde." },
        { status: statusCode }
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "Ocurrió un error al ejecutar una consulta en la base de datos.";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "La solicitud al servicio API no es válida. Por favor, comprueba tu entrada e inténtalo de nuevo.";

    case "bad_request:activate_gateway":
      return "La solicitud para activar el gateway. Por favor, comprueba tu entrada e inténtalo de nuevo.";

    case "unauthorized:auth":
      return "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.";
    case "forbidden:auth":
      return "Tu cuenta no tiene acceso a esta función.";

    case "rate_limit:chat":
      return "Has superado el número máximo de mensajes para el día. Por favor, inténtalo de nuevo más tarde.";
    case "not_found:chat":
      return "El chat solicitado no fue encontrado. Por favor, verifica el ID del chat e inténtalo de nuevo.";
    case "forbidden:chat":
      return "Este chat pertenece a otro usuario. Por favor, verifica el ID del chat e inténtalo de nuevo.";
    case "unauthorized:chat":
      return "Necesitas iniciar sesión para ver este chat. Por favor, inicia sesión e inténtalo de nuevo.";
    case "offline:chat":
      return "Estamos teniendo problemas para enviar tu mensaje. Por favor, verifica tu conexión a internet e inténtalo de nuevo.";
    case "not_found:document":
      return "El documento solicitado no fue encontrado. Por favor, verifica el ID del documento e inténtalo de nuevo.";
    case "forbidden:document":
      return "Este documento pertenece a otro usuario. Por favor, verifica el ID del documento e inténtalo de nuevo.";
    case "unauthorized:document":
      return "Necesitas iniciar sesión para ver este documento. Por favor, inicia sesión e inténtalo de nuevo.";
    case "bad_request:document":
      return "La solicitud para crear o actualizar el documento no es válida. Por favor, comprueba tu entrada e inténtalo de nuevo.";
    default:
      return "Algo salió mal. Por favor, inténtalo de nuevo más tarde.";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
