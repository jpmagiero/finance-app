export function cents(value: string, signed = false): number {
  const normalized = value.trim().replace(",", ".");
  if (!(signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(normalized))
    throw new Error("Informe um valor com até duas casas decimais, como 125,50.");
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  const valueCents =
    (BigInt(whole ?? "0") * 100n + BigInt(fraction.padEnd(2, "0"))) * (negative ? -1n : 1n);
  if (valueCents > BigInt(Number.MAX_SAFE_INTEGER) || valueCents < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error("Valor fora do limite permitido.");
  return Number(valueCents);
}
export function amountInput(value: number) {
  const absolute = BigInt(value < 0 ? -value : value);
  return `${value < 0 ? "-" : ""}${absolute / 100n},${String(absolute % 100n).padStart(2, "0")}`;
}
export function money(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value / 100);
}
export function dateLabel(date: string) {
  return date.split("-").reverse().join("/");
}
export function today(timezone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
