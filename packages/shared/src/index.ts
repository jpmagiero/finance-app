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
export const moneyCentsSchema = z.number().int().nonnegative();
export const positiveMoneyCentsSchema = z.number().int().positive();
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const monthStringSchema = z.string().regex(/^\d{4}-\d{2}$/);

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
  initialBalanceCents: z.number().int().default(0),
  currentBalanceCents: z.number().int().optional(),
  creditLimitCents: z.number().int().nonnegative().nullable().optional(),
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
    const splitTotal = value.splits.reduce((total, split) => total + split.amountCents, 0);

    if (splitTotal !== value.amountCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A soma dos splits deve ser igual ao valor total da transacao.",
        path: ["splits"],
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
