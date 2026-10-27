import type { RecurringInput } from "@finance/shared";

const dayMs = 86400000;
function parts(date: string) {
  return date.split("-").map(Number) as [number, number, number];
}
function dateAt(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
export function occurrenceDates(
  rule: Pick<RecurringInput, "startsAt" | "endsAt" | "frequency" | "interval">,
  from: string,
  to: string,
) {
  const [year, month, day] = parts(rule.startsAt);
  const anchor = dateAt(year, month - 1, day);
  const lower = from > rule.startsAt ? from : rule.startsAt;
  const upper = rule.endsAt && rule.endsAt < to ? rule.endsAt : to;
  if (lower > upper) return [];
  const result: string[] = [];
  if (rule.frequency === "daily" || rule.frequency === "weekly") {
    const step = rule.interval * (rule.frequency === "weekly" ? 7 : 1) * dayMs;
    const first = Math.max(0, Math.ceil((new Date(lower).getTime() - anchor.getTime()) / step));
    for (
      let timestamp = anchor.getTime() + first * step;
      timestamp <= new Date(upper).getTime();
      timestamp += step
    )
      result.push(new Date(timestamp).toISOString().slice(0, 10));
  } else {
    const [lowerYear, lowerMonth] = parts(lower);
    const step = rule.interval * (rule.frequency === "yearly" ? 12 : 1);
    const first = Math.max(0, Math.floor(((lowerYear - year) * 12 + lowerMonth - month) / step));
    for (let index = first; ; index++) {
      const totalMonth = year * 12 + month - 1 + index * step;
      const currentYear = Math.floor(totalMonth / 12),
        currentMonth = totalMonth % 12;
      if (currentYear > 9999) break;
      const lastDay = dateAt(currentYear, currentMonth + 1, 0).getUTCDate();
      const date = dateAt(currentYear, currentMonth, Math.min(day, lastDay))
        .toISOString()
        .slice(0, 10);
      if (date > upper) break;
      if (date >= lower) result.push(date);
    }
  }
  return result;
}
