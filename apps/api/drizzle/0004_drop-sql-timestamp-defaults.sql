PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`initial_balance_cents` integer DEFAULT 0 NOT NULL,
	`current_balance_cents` integer DEFAULT 0 NOT NULL,
	`credit_limit_cents` integer,
	`statement_closing_day` integer,
	`statement_due_day` integer,
	`is_shared` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `household_people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "household_id", "person_id", "name", "type", "institution", "currency", "initial_balance_cents", "current_balance_cents", "credit_limit_cents", "statement_closing_day", "statement_due_day", "is_shared", "is_archived", "created_at", "updated_at") SELECT "id", "household_id", "person_id", "name", "type", "institution", "currency", "initial_balance_cents", "current_balance_cents", "credit_limit_cents", "statement_closing_day", "statement_due_day", "is_shared", "is_archived", "created_at", "updated_at" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `accounts_household_idx` ON `accounts` (`household_id`);--> statement-breakpoint
CREATE INDEX `accounts_person_idx` ON `accounts` (`person_id`);--> statement-breakpoint
CREATE TABLE `__new_budget_items` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`category_id` text NOT NULL,
	`limit_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_budget_items`("id", "budget_id", "category_id", "limit_cents", "created_at", "updated_at") SELECT "id", "budget_id", "category_id", "limit_cents", "created_at", "updated_at" FROM `budget_items`;--> statement-breakpoint
DROP TABLE `budget_items`;--> statement-breakpoint
ALTER TABLE `__new_budget_items` RENAME TO `budget_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_items_budget_category_idx` ON `budget_items` (`budget_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text,
	`name` text NOT NULL,
	`period` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `household_people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "household_id", "person_id", "name", "period", "starts_at", "ends_at", "created_at", "updated_at") SELECT "id", "household_id", "person_id", "name", "period", "starts_at", "ends_at", "created_at", "updated_at" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE INDEX `budgets_household_idx` ON `budgets` (`household_id`);--> statement-breakpoint
CREATE INDEX `budgets_person_idx` ON `budgets` (`person_id`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`color` text,
	`icon` text,
	`is_system` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "household_id", "parent_id", "name", "type", "color", "icon", "is_system", "is_archived", "created_at", "updated_at") SELECT "id", "household_id", "parent_id", "name", "type", "color", "icon", "is_system", "is_archived", "created_at", "updated_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_household_type_name_idx` ON `categories` (`household_id`,`type`,`name`);--> statement-breakpoint
CREATE INDEX `categories_household_idx` ON `categories` (`household_id`);--> statement-breakpoint
CREATE TABLE `__new_household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_household_members`("id", "household_id", "user_id", "role", "created_at", "updated_at") SELECT "id", "household_id", "user_id", "role", "created_at", "updated_at" FROM `household_members`;--> statement-breakpoint
DROP TABLE `household_members`;--> statement-breakpoint
ALTER TABLE `__new_household_members` RENAME TO `household_members`;--> statement-breakpoint
CREATE UNIQUE INDEX `household_members_household_user_idx` ON `household_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `household_members_user_idx` ON `household_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_household_people` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`color` text,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_household_people`("id", "household_id", "user_id", "name", "color", "avatar_url", "is_active", "created_at", "updated_at") SELECT "id", "household_id", "user_id", "name", "color", "avatar_url", "is_active", "created_at", "updated_at" FROM `household_people`;--> statement-breakpoint
DROP TABLE `household_people`;--> statement-breakpoint
ALTER TABLE `__new_household_people` RENAME TO `household_people`;--> statement-breakpoint
CREATE INDEX `household_people_household_idx` ON `household_people` (`household_id`);--> statement-breakpoint
CREATE INDEX `household_people_user_idx` ON `household_people` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_households`("id", "name", "created_at", "updated_at") SELECT "id", "name", "created_at", "updated_at" FROM `households`;--> statement-breakpoint
DROP TABLE `households`;--> statement-breakpoint
ALTER TABLE `__new_households` RENAME TO `households`;--> statement-breakpoint
CREATE TABLE `__new_payees` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_payees`("id", "household_id", "name", "normalized_name", "created_at", "updated_at") SELECT "id", "household_id", "name", "normalized_name", "created_at", "updated_at" FROM `payees`;--> statement-breakpoint
DROP TABLE `payees`;--> statement-breakpoint
ALTER TABLE `__new_payees` RENAME TO `payees`;--> statement-breakpoint
CREATE UNIQUE INDEX `payees_household_normalized_name_idx` ON `payees` (`household_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `__new_recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text,
	`account_id` text,
	`category_id` text,
	`payee_id` text,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`day_of_month` integer,
	`day_of_week` integer,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`next_run_at` text,
	`auto_create` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `household_people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_recurring_transactions`("id", "household_id", "person_id", "account_id", "category_id", "payee_id", "type", "amount_cents", "description", "frequency", "interval", "day_of_month", "day_of_week", "starts_at", "ends_at", "next_run_at", "auto_create", "is_active", "created_at", "updated_at") SELECT "id", "household_id", "person_id", "account_id", "category_id", "payee_id", "type", "amount_cents", "description", "frequency", "interval", "day_of_month", "day_of_week", "starts_at", "ends_at", "next_run_at", "auto_create", "is_active", "created_at", "updated_at" FROM `recurring_transactions`;--> statement-breakpoint
DROP TABLE `recurring_transactions`;--> statement-breakpoint
ALTER TABLE `__new_recurring_transactions` RENAME TO `recurring_transactions`;--> statement-breakpoint
CREATE INDEX `recurring_transactions_household_idx` ON `recurring_transactions` (`household_id`);--> statement-breakpoint
CREATE INDEX `recurring_transactions_next_run_at_idx` ON `recurring_transactions` (`next_run_at`);--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`locale` text DEFAULT 'pt-BR' NOT NULL,
	`monthly_period_start_day` integer DEFAULT 1 NOT NULL,
	`include_pending_in_reports` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "household_id", "currency", "timezone", "locale", "monthly_period_start_day", "include_pending_in_reports", "created_at", "updated_at") SELECT "id", "household_id", "currency", "timezone", "locale", "monthly_period_start_day", "include_pending_in_reports", "created_at", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `settings_household_id_unique` ON `settings` (`household_id`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "household_id", "name", "color", "created_at", "updated_at") SELECT "id", "household_id", "name", "color", "created_at", "updated_at" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_household_name_idx` ON `tags` (`household_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`category_id` text,
	`amount_cents` integer NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transaction_splits`("id", "transaction_id", "category_id", "amount_cents", "description", "created_at", "updated_at") SELECT "id", "transaction_id", "category_id", "amount_cents", "description", "created_at", "updated_at" FROM `transaction_splits`;--> statement-breakpoint
DROP TABLE `transaction_splits`;--> statement-breakpoint
ALTER TABLE `__new_transaction_splits` RENAME TO `transaction_splits`;--> statement-breakpoint
CREATE INDEX `transaction_splits_transaction_idx` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_splits_category_idx` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`person_id` text,
	`account_id` text,
	`payee_id` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text,
	`notes` text,
	`transaction_date` text NOT NULL,
	`competence_date` text,
	`transfer_account_id` text,
	`linked_transaction_id` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_transaction_id` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `household_people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "household_id", "person_id", "account_id", "payee_id", "type", "status", "amount_cents", "description", "notes", "transaction_date", "competence_date", "transfer_account_id", "linked_transaction_id", "is_recurring", "recurring_transaction_id", "created_by_user_id", "created_at", "updated_at", "deleted_at") SELECT "id", "household_id", "person_id", "account_id", "payee_id", "type", "status", "amount_cents", "description", "notes", "transaction_date", "competence_date", "transfer_account_id", "linked_transaction_id", "is_recurring", "recurring_transaction_id", "created_by_user_id", "created_at", "updated_at", "deleted_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_household_date_idx` ON `transactions` (`household_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_transfer_account_idx` ON `transactions` (`transfer_account_id`);--> statement-breakpoint
CREATE INDEX `transactions_payee_idx` ON `transactions` (`payee_id`);--> statement-breakpoint
CREATE INDEX `transactions_person_idx` ON `transactions` (`person_id`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password_hash", "avatar_url", "is_active", "created_at", "updated_at") SELECT "id", "name", "email", "password_hash", "avatar_url", "is_active", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);