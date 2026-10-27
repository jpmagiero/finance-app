CREATE TABLE `recurring_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_transaction_id` text NOT NULL,
	`category_id` text,
	`amount_cents` integer NOT NULL,
	`description` text,
	FOREIGN KEY (`recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_splits_recurring_idx` ON `recurring_splits` (`recurring_transaction_id`);--> statement-breakpoint
CREATE TABLE `recurring_tags` (
	`recurring_transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`recurring_transaction_id`, `tag_id`),
	FOREIGN KEY (`recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `occurrence_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_recurring_occurrence_idx` ON `transactions` (`recurring_transaction_id`,`occurrence_date`);