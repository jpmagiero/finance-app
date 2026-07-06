-- Backfill de saldo: a regra de impacto de transacoes no saldo passou a somar
-- ajustes ("adjustment") confirmados ao current_balance_cents (ver
-- src/lib/balance.ts). Bancos criados antes dessa regra tem saldos que nunca
-- incorporaram ajustes; sem este recalculo, reverter/editar um ajuste antigo
-- subtrairia um impacto que nunca foi aplicado. Recomputa o saldo de todas as
-- contas com a mesma regra de balanceDeltas/recalculateAccountBalance.
UPDATE `accounts` SET `current_balance_cents` = `initial_balance_cents` + (
	SELECT COALESCE(SUM(
		CASE
			WHEN `t`.`account_id` = `accounts`.`id` AND `t`.`type` = 'income' THEN `t`.`amount_cents`
			WHEN `t`.`account_id` = `accounts`.`id` AND `t`.`type` = 'expense' THEN -`t`.`amount_cents`
			WHEN `t`.`account_id` = `accounts`.`id` AND `t`.`type` = 'adjustment' THEN `t`.`amount_cents`
			WHEN `t`.`account_id` = `accounts`.`id` AND `t`.`type` = 'transfer' AND `t`.`transfer_account_id` IS NOT NULL THEN -`t`.`amount_cents`
			ELSE 0
		END
		+
		CASE
			WHEN `t`.`transfer_account_id` = `accounts`.`id` AND `t`.`type` = 'transfer' AND `t`.`account_id` IS NOT NULL THEN `t`.`amount_cents`
			ELSE 0
		END
	), 0)
	FROM `transactions` `t`
	WHERE `t`.`status` = 'confirmed'
		AND `t`.`deleted_at` IS NULL
		AND (`t`.`account_id` = `accounts`.`id` OR `t`.`transfer_account_id` = `accounts`.`id`)
);
