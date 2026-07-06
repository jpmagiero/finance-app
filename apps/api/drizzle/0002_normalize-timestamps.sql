-- Normaliza timestamps gravados pelo DEFAULT CURRENT_TIMESTAMP do SQLite
-- ("YYYY-MM-DD HH:MM:SS", UTC) para o formato ISO-8601 usado pela aplicacao
-- ("YYYY-MM-DDTHH:MM:SS.000Z"), garantindo ordenacao lexicografica coerente.
UPDATE `users` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `users` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `households` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `households` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `household_members` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `household_members` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `household_people` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `household_people` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `settings` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `settings` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `accounts` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `accounts` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `categories` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `categories` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `payees` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `payees` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `recurring_transactions` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `recurring_transactions` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `transactions` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `transactions` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `transaction_splits` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `transaction_splits` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `tags` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `tags` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `budgets` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `budgets` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';--> statement-breakpoint
UPDATE `budget_items` SET `created_at` = replace(`created_at`, ' ', 'T') || '.000Z' WHERE `created_at` LIKE '% %';--> statement-breakpoint
UPDATE `budget_items` SET `updated_at` = replace(`updated_at`, ' ', 'T') || '.000Z' WHERE `updated_at` LIKE '% %';
