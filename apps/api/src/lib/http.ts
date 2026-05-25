import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export function handleRouteError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "validation_error",
      issues: error.issues,
    });
  }

  if (error instanceof Error && error.message.startsWith("not_found:")) {
    return reply.status(404).send({
      error: "not_found",
      message: error.message.replace("not_found:", ""),
    });
  }

  if (error instanceof Error && error.message.startsWith("bad_request:")) {
    return reply.status(400).send({
      error: "bad_request",
      message: error.message.replace("bad_request:", ""),
    });
  }

  throw error;
}

export function notFound(message: string): never {
  throw new Error(`not_found:${message}`);
}

export function badRequest(message: string): never {
  throw new Error(`bad_request:${message}`);
}
