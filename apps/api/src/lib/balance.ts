export type BalanceImpactInput = {
  type: string;
  status: string;
  amountCents: number;
  accountId: string | null;
  transferAccountId: string | null;
};

export type BalanceDelta = {
  accountId: string;
  deltaCents: number;
};

// Fonte unica da regra "como cada tipo de transacao afeta saldos de conta".
// Consumida tanto pelo caminho incremental (criar/editar/excluir transacao)
// quanto pelo recalculo completo de saldo — os dois nunca podem divergir.
export function balanceDeltas(transaction: BalanceImpactInput): BalanceDelta[] {
  if (transaction.status !== "confirmed") {
    return [];
  }

  const { type, amountCents, accountId, transferAccountId } = transaction;

  if (type === "income" && accountId) {
    return [{ accountId, deltaCents: amountCents }];
  }

  if (type === "expense" && accountId) {
    return [{ accountId, deltaCents: -amountCents }];
  }

  // Ajuste soma o valor com sinal ao saldo da conta.
  if (type === "adjustment" && accountId) {
    return [{ accountId, deltaCents: amountCents }];
  }

  if (type === "transfer" && accountId && transferAccountId) {
    return [
      { accountId, deltaCents: -amountCents },
      { accountId: transferAccountId, deltaCents: amountCents },
    ];
  }

  return [];
}
