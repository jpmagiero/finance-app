import { z } from "zod";

export const appName = "Finance App";

export const accountTypes = [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "investment",
  "loan",
  "other",
] as const;

export const categoryTypes = ["income", "expense", "transfer"] as const;
export const transactionTypes = ["income", "expense", "transfer", "adjustment"] as const;
export const transactionStatuses = ["pending", "confirmed", "canceled"] as const;
export const memberRoles = ["owner", "admin", "member"] as const;
export const recurringFrequencies = ["daily", "weekly", "monthly", "yearly"] as const;
export const budgetPeriods = ["monthly", "yearly", "custom"] as const;

export type AccountType = (typeof accountTypes)[number];
export type CategoryType = (typeof categoryTypes)[number];
export type TransactionType = (typeof transactionTypes)[number];
export type TransactionStatus = (typeof transactionStatuses)[number];
export type MemberRole = (typeof memberRoles)[number];
export type RecurringFrequency = (typeof recurringFrequencies)[number];
export type BudgetPeriod = (typeof budgetPeriods)[number];

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export const MAX_MONEY_CENTS = 1_000_000_000_000;

export const idSchema = z.string().min(1);
export const moneyCentsSchema = z.number().int().min(0).max(MAX_MONEY_CENTS);
export const positiveMoneyCentsSchema = z.number().int().positive().max(MAX_MONEY_CENTS);
export const signedMoneyCentsSchema = z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS);
function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Valida data de calendario real sem passar por Date (que faz rollover
// silencioso de valores invalidos, ex.: 2026-02-31 -> 2026-03-03).
function isValidCalendarDate(value: string) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1] ?? 0;

  return day >= 1 && day <= maxDay;
}

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarDate, "Data de calendario invalida.");
export const monthStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((value) => {
    const month = Number(value.slice(5, 7));

    return month >= 1 && month <= 12;
  }, "Mes invalido.");

const optionalIdSchema = idSchema.nullable().optional();
const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//.test(value), "URL deve usar http ou https.");

// ---------------------------------------------------------------------------
// Schemas de entrada
// ---------------------------------------------------------------------------

export const createPersonSchema = z.object({
  householdId: idSchema,
  userId: optionalIdSchema,
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().max(32).nullable().optional(),
  avatarUrl: httpUrlSchema.nullable().optional(),
});
export const updatePersonSchema = createPersonSchema.omit({ householdId: true }).partial();

export const createCategorySchema = z.object({
  householdId: idSchema,
  parentId: optionalIdSchema,
  name: z.string().trim().min(1).max(120),
  type: z.enum(categoryTypes),
  color: z.string().trim().max(32).nullable().optional(),
  icon: z.string().trim().max(80).nullable().optional(),
});
export const updateCategorySchema = createCategorySchema.omit({ householdId: true }).partial();

export const createAccountSchema = z.object({
  householdId: idSchema,
  personId: optionalIdSchema,
  name: z.string().trim().min(1).max(120),
  type: z.enum(accountTypes),
  institution: z.string().trim().max(120).nullable().optional(),
  currency: z.string().trim().length(3).default("BRL"),
  initialBalanceCents: signedMoneyCentsSchema.default(0),
  creditLimitCents: moneyCentsSchema.nullable().optional(),
  statementClosingDay: z.number().int().min(1).max(31).nullable().optional(),
  statementDueDay: z.number().int().min(1).max(31).nullable().optional(),
  isShared: z.boolean().default(false),
});
export const updateAccountSchema = createAccountSchema.omit({ householdId: true }).partial();

export const updateSettingsSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  monthlyPeriodStartDay: z.number().int().min(1).max(28).optional(),
  includePendingInReports: z.boolean().optional(),
});

export const createTagSchema = z.object({
  householdId: idSchema,
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(32).nullable().optional(),
});
export const updateTagSchema = createTagSchema.omit({ householdId: true }).partial();

export const createPayeeSchema = z.object({
  householdId: idSchema,
  name: z.string().trim().min(1).max(160),
});
export const updatePayeeSchema = createPayeeSchema.omit({ householdId: true }).partial();

const transactionSplitInputSchema = z.object({
  categoryId: optionalIdSchema,
  amountCents: signedMoneyCentsSchema,
  description: z.string().trim().max(180).nullable().optional(),
});

const transactionBaseSchema = z.object({
  householdId: idSchema,
  personId: optionalIdSchema,
  accountId: optionalIdSchema,
  payeeId: optionalIdSchema,
  type: z.enum(transactionTypes),
  status: z.enum(transactionStatuses).default("confirmed"),
  amountCents: signedMoneyCentsSchema,
  description: z.string().trim().max(180).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  transactionDate: dateStringSchema,
  competenceDate: dateStringSchema.nullable().optional(),
  transferAccountId: optionalIdSchema,
  splits: z.array(transactionSplitInputSchema).min(1).max(100),
  tagIds: z.array(idSchema).max(50).default([]),
});

function addTransactionRuleIssues(
  value: z.infer<typeof transactionBaseSchema>,
  context: z.RefinementCtx,
) {
  const splitTotal = value.splits.reduce((total, split) => total + split.amountCents, 0);

  if (splitTotal !== value.amountCents) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A soma dos splits deve ser igual ao valor total da transacao.",
      path: ["splits"],
    });
  }

  if (value.type === "adjustment") {
    if (value.amountCents === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ajustes devem ter valor diferente de zero.",
        path: ["amountCents"],
      });
    }

    if (!value.accountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ajustes precisam de uma conta.",
        path: ["accountId"],
      });
    }
  } else {
    if (value.amountCents <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Valor da transacao deve ser positivo.",
        path: ["amountCents"],
      });
    }

    for (const [index, split] of value.splits.entries()) {
      if (split.amountCents <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valor do split deve ser positivo.",
          path: ["splits", index, "amountCents"],
        });
      }
    }
  }

  if (value.type === "transfer") {
    if (!value.accountId || !value.transferAccountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transferencias precisam de conta de origem e destino.",
        path: ["transferAccountId"],
      });
    }

    if (value.accountId && value.transferAccountId && value.accountId === value.transferAccountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Conta de origem e destino devem ser diferentes.",
        path: ["transferAccountId"],
      });
    }
  } else if (value.transferAccountId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Apenas transferencias podem ter conta de destino.",
      path: ["transferAccountId"],
    });
  }
}

export const createTransactionSchema = transactionBaseSchema.superRefine(addTransactionRuleIssues);

// Atualizacao parcial: householdId e imutavel; amountCents e splits andam juntos
// porque a soma dos splits precisa bater com o total. As demais regras sao
// validadas no servidor apos o merge com a transacao existente.
export const updateTransactionSchema = transactionBaseSchema
  .omit({ householdId: true })
  .partial()
  .superRefine((value, context) => {
    const hasAmount = value.amountCents !== undefined;
    const hasSplits = value.splits !== undefined;

    if (hasAmount !== hasSplits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amountCents e splits devem ser enviados juntos.",
        path: [hasAmount ? "splits" : "amountCents"],
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CreatePayeeInput = z.infer<typeof createPayeeSchema>;
export type UpdatePayeeInput = z.infer<typeof updatePayeeSchema>;

// ---------------------------------------------------------------------------
// DTOs de resposta da API
//
// Estes schemas sao usados pelo serializador do Fastify (campos fora do schema
// sao removidos da resposta) e pelo front para tipar o que consome. Devem
// espelhar exatamente o que os services retornam.
// ---------------------------------------------------------------------------

const timestampFields = {
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const householdSchema = z.object({
  id: z.string(),
  name: z.string(),
  ...timestampFields,
});

export const householdMemberSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  userId: z.string(),
  role: z.enum(memberRoles),
  ...timestampFields,
});

export const householdPersonSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isActive: z.boolean(),
  ...timestampFields,
});

export const settingsSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  currency: z.string(),
  timezone: z.string(),
  locale: z.string(),
  monthlyPeriodStartDay: z.number().int(),
  includePendingInReports: z.boolean(),
  ...timestampFields,
});

export const accountSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  personId: z.string().nullable(),
  name: z.string(),
  type: z.enum(accountTypes),
  institution: z.string().nullable(),
  currency: z.string(),
  initialBalanceCents: z.number().int(),
  currentBalanceCents: z.number().int(),
  creditLimitCents: z.number().int().nullable(),
  statementClosingDay: z.number().int().nullable(),
  statementDueDay: z.number().int().nullable(),
  isShared: z.boolean(),
  isArchived: z.boolean(),
  ...timestampFields,
});

export const categorySchema = z.object({
  id: z.string(),
  householdId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  type: z.enum(categoryTypes),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  isSystem: z.boolean(),
  isArchived: z.boolean(),
  ...timestampFields,
});

export const payeeSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  ...timestampFields,
});

export const tagSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  ...timestampFields,
});

export const transactionSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  personId: z.string().nullable(),
  accountId: z.string().nullable(),
  payeeId: z.string().nullable(),
  type: z.enum(transactionTypes),
  status: z.enum(transactionStatuses),
  amountCents: z.number().int(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  transactionDate: dateStringSchema,
  competenceDate: z.string().nullable(),
  transferAccountId: z.string().nullable(),
  linkedTransactionId: z.string().nullable(),
  isRecurring: z.boolean(),
  recurringTransactionId: z.string().nullable(),
  createdByUserId: z.string().nullable(),
  ...timestampFields,
  deletedAt: z.string().nullable(),
});

export const transactionSplitSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  categoryId: z.string().nullable(),
  amountCents: z.number().int(),
  description: z.string().nullable(),
  ...timestampFields,
});

export const transactionWithDetailsSchema = transactionSchema.extend({
  splits: z.array(transactionSplitSchema),
  tagIds: z.array(z.string()),
});

export const householdOverviewSchema = z.object({
  household: householdSchema,
  settings: settingsSchema.nullable(),
  people: z.array(householdPersonSchema),
  members: z.array(householdMemberSchema),
});

export const dashboardCategoryTotalSchema = z.object({
  category: categorySchema.nullable(),
  amountCents: z.number().int(),
});

export const monthlyDashboardSchema = z.object({
  month: monthStringSchema,
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
  incomeCents: z.number().int(),
  expenseCents: z.number().int(),
  balanceCents: z.number().int(),
  transactionCount: z.number().int(),
  categories: z.array(dashboardCategoryTotalSchema),
});

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  issues: z.array(z.record(z.unknown())).optional(),
});

export const healthSchema = z.object({
  status: z.string(),
  uptime: z.number(),
});

export const apiInfoSchema = z.object({
  name: z.string(),
  status: z.string(),
});

export type Household = z.infer<typeof householdSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type HouseholdPerson = z.infer<typeof householdPersonSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Payee = z.infer<typeof payeeSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionSplit = z.infer<typeof transactionSplitSchema>;
export type TransactionWithDetails = z.infer<typeof transactionWithDetailsSchema>;
export type HouseholdOverview = z.infer<typeof householdOverviewSchema>;
export type MonthlyDashboard = z.infer<typeof monthlyDashboardSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
