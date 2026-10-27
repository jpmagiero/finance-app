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

export const idSchema = z.string().min(1);
export const signedMoneyCentsSchema = z.number().int().safe();
export const moneyCentsSchema = signedMoneyCentsSchema.nonnegative();
export const positiveMoneyCentsSchema = signedMoneyCentsSchema.positive();
export const dateStringSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data de calendario invalida.");
export const monthStringSchema = z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/);

const optionalIdSchema = idSchema.nullable().optional();

export const createPersonSchema = z.object({
  householdId: idSchema,
  userId: optionalIdSchema,
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().max(32).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
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
  currentBalanceCents: z.never().optional(),
  creditLimitCents: moneyCentsSchema.nullable().optional(),
  statementClosingDay: z.number().int().min(1).max(31).nullable().optional(),
  statementDueDay: z.number().int().min(1).max(31).nullable().optional(),
  isShared: z.boolean().default(false),
});
export const updateAccountSchema = createAccountSchema.omit({ householdId: true }).partial();

export const updateSettingsSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horario invalido.")
    .optional(),
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

const transactionPayloadSchema = z
  .object({
    householdId: idSchema,
    personId: optionalIdSchema,
    accountId: optionalIdSchema,
    payeeId: optionalIdSchema,
    type: z.enum(transactionTypes),
    status: z.enum(transactionStatuses).default("confirmed"),
    amountCents: positiveMoneyCentsSchema,
    description: z.string().trim().max(180).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    transactionDate: dateStringSchema,
    competenceDate: dateStringSchema.nullable().optional(),
    transferAccountId: optionalIdSchema,
    splits: z
      .array(
        z.object({
          categoryId: optionalIdSchema,
          amountCents: positiveMoneyCentsSchema,
          description: z.string().trim().max(180).nullable().optional(),
        }),
      )
      .min(1),
    tagIds: z.array(idSchema).default([]),
  })
  .superRefine((value, context) => {
    const safeAmounts =
      Number.isSafeInteger(value.amountCents) &&
      value.splits.every((split) => Number.isSafeInteger(split.amountCents));
    const splitTotal = safeAmounts
      ? value.splits.reduce((total, split) => total + BigInt(split.amountCents), 0n)
      : null;

    if (splitTotal === null || splitTotal !== BigInt(value.amountCents)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A soma dos splits deve ser igual ao valor total da transacao.",
        path: ["splits"],
      });
    }

    if (value.type === "adjustment") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ajustes ainda nao estao disponiveis.",
        path: ["type"],
      });
    }

    if (value.type !== "transfer" && value.transferAccountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas transferencias podem ter conta de destino.",
        path: ["transferAccountId"],
      });
    }

    if (value.type === "transfer") {
      if (!value.accountId || !value.transferAccountId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Transferencias precisam de conta de origem e destino.",
          path: ["transferAccountId"],
        });
      }

      if (
        value.accountId &&
        value.transferAccountId &&
        value.accountId === value.transferAccountId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conta de origem e destino devem ser diferentes.",
          path: ["transferAccountId"],
        });
      }
    }
  });

export const createTransactionSchema = transactionPayloadSchema;

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
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

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .refine((value) => value.includes("@"), "E-mail invalido."),
  password: z.string().min(1).max(128),
});
export const newLoginSchema = loginSchema.extend({
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
  personId: idSchema.optional(),
});
export type AuthSession = {
  user: { id: string; name: string; email: string };
  householdId: string;
  role: MemberRole;
  csrfToken: string;
};

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export const recurrenceFrequencies = ["daily", "weekly", "monthly", "yearly"] as const;
export const recurringInputSchema = transactionPayloadSchema
  .innerType()
  .omit({ transactionDate: true, competenceDate: true, status: true, transferAccountId: true })
  .extend({
    type: z.enum(["income", "expense"]),
    frequency: z.enum(recurrenceFrequencies),
    interval: z.number().int().min(1).max(120).default(1),
    startsAt: dateStringSchema,
    endsAt: dateStringSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endsAt && value.endsAt < value.startsAt)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fim deve ser igual ou posterior ao inicio.",
        path: ["endsAt"],
      });
    const result = createTransactionSchema.safeParse({
      ...value,
      status: "pending",
      transactionDate: value.startsAt,
    });
    if (!result.success) for (const issue of result.error.issues) context.addIssue(issue);
  });
export type RecurringInput = z.infer<typeof recurringInputSchema>;
export const recurrenceRangeSchema = z
  .object({ from: dateStringSchema, to: dateStringSchema })
  .strict()
  .refine(
    (value) =>
      value.from <= value.to &&
      new Date(value.to).getTime() - new Date(value.from).getTime() <= 365 * 86400000,
    {
      message: "Escolha um intervalo de ate 366 dias, com inicio menor ou igual ao fim.",
      path: ["to"],
    },
  );

export const budgetInputSchema = z
  .object({
    householdId: idSchema,
    personId: optionalIdSchema,
    name: z.string().trim().min(1).max(120),
    period: z.enum(budgetPeriods),
    startsAt: dateStringSchema,
    endsAt: dateStringSchema,
    currency: z.string().regex(/^[A-Z]{3}$/, "Use uma moeda de tres letras, como BRL."),
    items: z
      .array(z.object({ categoryId: idSchema, limitCents: positiveMoneyCentsSchema }).strict())
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startsAt > value.endsAt)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inicio deve ser menor ou igual ao fim.",
        path: ["endsAt"],
      });
    if (new Set(value.items.map((item) => item.categoryId)).size !== value.items.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cada categoria pode ter somente um limite.",
        path: ["items"],
      });
    if (
      value.items.every((item) => Number.isSafeInteger(item.limitCents)) &&
      value.items.reduce((total, item) => total + BigInt(item.limitCents), 0n) >
        BigInt(Number.MAX_SAFE_INTEGER)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Soma dos limites fora da faixa segura.",
        path: ["items"],
      });
  });
export type BudgetInput = z.infer<typeof budgetInputSchema>;
export function budgetPeriodRange(period: "monthly" | "yearly", anchor: string, startDay = 1) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(
    Number(anchor.slice(0, 4)),
    period === "yearly" ? 0 : Number(anchor.slice(5, 7)) - 1,
    period === "yearly" ? 1 : startDay,
  );
  const startsAt = date.toISOString().slice(0, 10);
  if (period === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return { startsAt, endsAt: date.toISOString().slice(0, 10) };
}

export type BudgetRecord = Omit<BudgetInput, "personId"> & {
  id: string;
  personId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};
export type BudgetConsumption = {
  confirmedCents: number;
  pendingCents: number;
  committedCents: number;
};
export type BudgetRemaining = { remainingCents: number; exceededCents: number };
export type BudgetSummary = {
  budget: BudgetRecord;
  items: (BudgetInput["items"][number] & { categoryName: string } & BudgetConsumption &
    BudgetRemaining)[];
  unbudgeted: ({ categoryId: string | null; categoryName: string } & BudgetConsumption)[];
  totals: { limitCents: number } & BudgetConsumption & BudgetRemaining;
  unbudgetedCents: number;
  excludedCurrencyCount: number;
};
