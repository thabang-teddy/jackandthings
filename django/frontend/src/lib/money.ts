const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

/** Display only. Dividing integer cents by 100 for formatting can't change a stored value. */
export const formatZar = (cents: number) => zar.format(cents / 100).replace("-", "−");

/** Signed, for ledgers: "+R 120,00" / "−R 46,50". */
export const formatSigned = (cents: number) => (cents > 0 ? "+" : "") + formatZar(cents);

/** Cents → the text a person would type back into an amount field: 4650 → "46,50". */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
