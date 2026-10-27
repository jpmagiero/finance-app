ALTER TABLE `budgets` ADD `currency` text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE `budgets` ADD `is_archived` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE budgets SET currency = coalesce((SELECT currency FROM settings WHERE settings.household_id = budgets.household_id), 'BRL');
