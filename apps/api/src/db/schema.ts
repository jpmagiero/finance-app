import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const householdMembers = sqliteTable(
  "household_members",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    ...timestamps,
  },
  (table) => ({
    householdUserIdx: uniqueIndex("household_members_household_user_idx").on(
      table.householdId,
      table.userId,
    ),
    userIdx: index("household_members_user_idx").on(table.userId),
  }),
);

export const householdPeople = sqliteTable(
  "household_people",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    color: text("color"),
    avatarUrl: text("avatar_url"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    householdIdx: index("household_people_household_idx").on(table.householdId),
    userIdx: index("household_people_user_idx").on(table.userId),
  }),
);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .unique()
    .references(() => households.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("BRL"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  locale: text("locale").notNull().default("pt-BR"),
  monthlyPeriodStartDay: integer("monthly_period_start_day").notNull().default(1),
  includePendingInReports: integer("include_pending_in_reports", { mode: "boolean" })
    .notNull()
    .default(true),
  ...timestamps,
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => householdPeople.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"],
    }).notNull(),
    institution: text("institution"),
    currency: text("currency").notNull().default("BRL"),
    initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
    currentBalanceCents: integer("current_balance_cents").notNull().default(0),
    creditLimitCents: integer("credit_limit_cents"),
    statementClosingDay: integer("statement_closing_day"),
    statementDueDay: integer("statement_due_day"),
    isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    householdIdx: index("accounts_household_idx").on(table.householdId),
    personIdx: index("accounts_person_idx").on(table.personId),
  }),
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
    color: text("color"),
    icon: text("icon"),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    householdTypeNameIdx: uniqueIndex("categories_household_type_name_idx").on(
      table.householdId,
      table.type,
      table.name,
    ),
    householdIdx: index("categories_household_idx").on(table.householdId),
  }),
);

export const payees = sqliteTable(
  "payees",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    ...timestamps,
  },
  (table) => ({
    householdNormalizedNameIdx: uniqueIndex("payees_household_normalized_name_idx").on(
      table.householdId,
      table.normalizedName,
    ),
  }),
);

export const recurringTransactions = sqliteTable(
  "recurring_transactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => householdPeople.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    payeeId: text("payee_id").references(() => payees.id, { onDelete: "set null" }),
    type: text("type", { enum: ["income", "expense", "transfer", "adjustment"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    interval: integer("interval").notNull().default(1),
    dayOfMonth: integer("day_of_month"),
    dayOfWeek: integer("day_of_week"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    nextRunAt: text("next_run_at"),
    autoCreate: integer("auto_create", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    householdIdx: index("recurring_transactions_household_idx").on(table.householdId),
    nextRunAtIdx: index("recurring_transactions_next_run_at_idx").on(table.nextRunAt),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => householdPeople.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    payeeId: text("payee_id").references(() => payees.id, { onDelete: "set null" }),
    type: text("type", { enum: ["income", "expense", "transfer", "adjustment"] }).notNull(),
    status: text("status", { enum: ["pending", "confirmed", "canceled"] })
      .notNull()
      .default("confirmed"),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    notes: text("notes"),
    transactionDate: text("transaction_date").notNull(),
    competenceDate: text("competence_date"),
    transferAccountId: text("transfer_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    linkedTransactionId: text("linked_transaction_id").references(
      (): AnySQLiteColumn => transactions.id,
      { onDelete: "set null" },
    ),
    isRecurring: integer("is_recurring", { mode: "boolean" }).notNull().default(false),
    recurringTransactionId: text("recurring_transaction_id").references(
      () => recurringTransactions.id,
      { onDelete: "set null" },
    ),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    householdDateIdx: index("transactions_household_date_idx").on(
      table.householdId,
      table.transactionDate,
    ),
    accountIdx: index("transactions_account_idx").on(table.accountId),
    personIdx: index("transactions_person_idx").on(table.personId),
    typeIdx: index("transactions_type_idx").on(table.type),
    statusIdx: index("transactions_status_idx").on(table.status),
  }),
);

export const transactionSplits = sqliteTable(
  "transaction_splits",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => ({
    transactionIdx: index("transaction_splits_transaction_idx").on(table.transactionId),
    categoryIdx: index("transaction_splits_category_idx").on(table.categoryId),
  }),
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    ...timestamps,
  },
  (table) => ({
    householdNameIdx: uniqueIndex("tags_household_name_idx").on(table.householdId, table.name),
  }),
);

export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.transactionId, table.tagId] }),
  }),
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => householdPeople.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    period: text("period", { enum: ["monthly", "yearly", "custom"] }).notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    ...timestamps,
  },
  (table) => ({
    householdIdx: index("budgets_household_idx").on(table.householdId),
    personIdx: index("budgets_person_idx").on(table.personId),
  }),
);

export const budgetItems = sqliteTable(
  "budget_items",
  {
    id: text("id").primaryKey(),
    budgetId: text("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    limitCents: integer("limit_cents").notNull(),
    ...timestamps,
  },
  (table) => ({
    budgetCategoryIdx: uniqueIndex("budget_items_budget_category_idx").on(
      table.budgetId,
      table.categoryId,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Household = typeof households.$inferSelect;
export type HouseholdPerson = typeof householdPeople.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
