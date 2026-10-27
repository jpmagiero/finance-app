import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function handleRouteError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError)
    return reply.status(error.statusCode).send({ error: error.code, message: error.message });
  if (error instanceof ZodError)
    return reply.status(400).send({
      error: "validation_error",
      message: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      issues: error.issues,
    });
  if (error instanceof Error && "validation" in error)
    return reply.status(400).send({ error: "validation_error", message: error.message });
  if (error instanceof Error && "statusCode" in error && error.statusCode === 429)
    return reply
      .status(429)
      .send({ error: "too_many_requests", message: "Muitas tentativas. Aguarde um minuto." });
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("FST_ERR_") &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    [400, 413, 415].includes(error.statusCode)
  ) {
    return reply.status(error.statusCode).send({
      error: "validation_error",
      message: "Requisicao invalida, excessiva ou com tipo de conteudo nao suportado.",
    });
  }
  let cause = error;
  for (let depth = 0; cause && typeof cause === "object" && depth < 5; depth++) {
    if ("code" in cause && typeof cause.code === "string") {
      if (
        cause.code.startsWith("SQLITE_CONSTRAINT_UNIQUE") ||
        cause.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
      )
        return reply
          .status(409)
          .send({ error: "conflict", message: "Ja existe um cadastro com estes dados." });
      if (cause.code === "SQLITE_CONSTRAINT_FOREIGNKEY")
        return reply
          .status(400)
          .send({ error: "bad_request", message: "Referencia invalida ou cadastro em uso." });
    }
    cause = "cause" in cause ? cause.cause : undefined;
  }
  reply.log.error(error);
  return reply
    .status(500)
    .send({ error: "internal_error", message: "Nao foi possivel concluir a operacao." });
}
export function notFound(message = "Recurso nao encontrado."): never {
  throw new HttpError(404, "not_found", message);
}
export function badRequest(message: string): never {
  throw new HttpError(400, "bad_request", message);
}
export function forbidden(message = "Acesso nao permitido."): never {
  throw new HttpError(403, "forbidden", message);
}
export function unauthorized(message = "Entre na sua conta para continuar."): never {
  throw new HttpError(401, "unauthorized", message);
}
