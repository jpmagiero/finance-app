CREATE INDEX `transaction_tags_tag_idx` ON `transaction_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `transactions_transfer_account_idx` ON `transactions` (`transfer_account_id`);--> statement-breakpoint
CREATE INDEX `transactions_payee_idx` ON `transactions` (`payee_id`);