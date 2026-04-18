import type { CurrencyDto } from "../api/types";

export function formatMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
  currencies?: CurrencyDto[] | null,
): string {
  if (minor == null) return "—";
  const decimals = currencies?.find((c) => c.code === currency)?.decimals ?? 2;
  const factor = Math.pow(10, decimals);
  const major = minor / factor;
  const formatted = major.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function signedMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
  currencies?: CurrencyDto[] | null,
): string {
  if (minor == null) return "—";
  const base = formatMoney(Math.abs(minor), currency, currencies);
  if (minor > 0) return `+${base}`;
  if (minor < 0) return `−${base}`;
  return base;
}

export function toMinor(
  value: string | number,
  currency: string | null | undefined,
  currencies?: CurrencyDto[] | null,
): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const decimals = currencies?.find((c) => c.code === currency)?.decimals ?? 2;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * Math.pow(10, decimals));
}

export function fromMinor(
  minor: number | null | undefined,
  currency: string | null | undefined,
  currencies?: CurrencyDto[] | null,
): string {
  if (minor == null) return "";
  const decimals = currencies?.find((c) => c.code === currency)?.decimals ?? 2;
  return (minor / Math.pow(10, decimals)).toFixed(decimals);
}

export function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}
