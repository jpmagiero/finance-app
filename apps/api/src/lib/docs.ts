export const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string" },
  },
} as const;

export const householdIdQuerySchema = {
  type: "object",
  required: ["householdId"],
  properties: {
    householdId: { type: "string" },
  },
} as const;

export const householdIdParamSchema = {
  type: "object",
  required: ["householdId"],
  properties: {
    householdId: { type: "string" },
  },
} as const;

export const dateStringProperty = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
} as const;

export const monthStringProperty = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}$",
} as const;

export const nullableStringProperty = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const;

export const optionalNullableStringProperty = nullableStringProperty;

export const nullableIntegerProperty = {
  anyOf: [{ type: "integer" }, { type: "null" }],
} as const;

export const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    issues: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
} as const;

export const genericObjectResponseSchema = {
  type: "object",
  additionalProperties: true,
} as const;

export const genericArrayResponseSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: true,
  },
} as const;
