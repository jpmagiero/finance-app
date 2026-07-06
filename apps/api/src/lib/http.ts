export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, "bad_request", message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, "not_found", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "conflict", message);
    this.name = "ConflictError";
  }
}

export function badRequest(message: string): never {
  throw new BadRequestError(message);
}

export function notFound(message: string): never {
  throw new NotFoundError(message);
}

export function conflict(message: string): never {
  throw new ConflictError(message);
}

export function isSqliteConstraintError(error: unknown, prefix = "SQLITE_CONSTRAINT"): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    ((error as { code: string }).code === prefix ||
      (error as { code: string }).code.startsWith(`${prefix}_`))
  );
}
