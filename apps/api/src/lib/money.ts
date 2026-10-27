import { badRequest } from "./http";

const maximum = BigInt(Number.MAX_SAFE_INTEGER);

export function safeMoneyCents(value: bigint): number {
  if (value > maximum || value < -maximum) {
    badRequest("Valor monetario fora da faixa segura de inteiros.");
  }
  return Number(value);
}

export function moneyAsBigInt(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    badRequest("Valor monetario fora da faixa segura de inteiros.");
  }
  return BigInt(value);
}

export function sumMoneyCents(values: number[]): number {
  return safeMoneyCents(values.reduce((sum, value) => sum + moneyAsBigInt(value), 0n));
}
