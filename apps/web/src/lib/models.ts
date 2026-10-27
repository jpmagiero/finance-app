import type { AccountType, CreateTransactionInput } from "@finance/shared";
export type Person = {
  id: string;
  name: string;
  isActive: boolean;
  userId: string | null;
  color: string | null;
};
export type Account = {
  id: string;
  name: string;
  type: AccountType;
  personId: string | null;
  institution: string | null;
  currency: string;
  initialBalanceCents: number;
  currentBalanceCents: number;
  isArchived: boolean;
  isShared: boolean;
};
export type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parentId: string | null;
  isArchived: boolean;
  color: string | null;
};
export type Named = { id: string; name: string; color?: string | null };
export type Settings = {
  currency: string;
  timezone: string;
  locale: string;
  monthlyPeriodStartDay: number;
  includePendingInReports: boolean;
};
export type Catalogs = {
  people: Person[];
  accounts: Account[];
  categories: Category[];
  payees: Named[];
  tags: Named[];
  settings: Settings;
};
export type Transaction = CreateTransactionInput & {
  id: string;
  createdByUserId: string | null;
  isRecurring?: boolean;
  recurringTransactionId?: string | null;
  occurrenceDate?: string | null;
};
export type Dashboard = {
  month: string;
  from: string;
  to: string;
  currency: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  transactionCount: number;
  confirmedIncomeCents: number;
  confirmedExpenseCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  hasMixedCurrencies: boolean;
  categories: { category: Category | null; amountCents: number }[];
  flow: { date: string; incomeCents: number; expenseCents: number }[];
};
export type TransactionPage = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
};
export const typeLabels = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  adjustment: "Ajuste",
};
export const statusLabels = { pending: "Pendente", confirmed: "Confirmado", canceled: "Cancelado" };
export const accountLabels: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  loan: "Empréstimo",
  other: "Outra",
};
