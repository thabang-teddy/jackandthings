/** kg are stored ×10 (77,5 kg = 775), body weight in grams, tape in millimetres. Display only. */
export const kg = (x10: number) => (x10 % 10 ? `${Math.floor(x10 / 10)},${x10 % 10}` : String(x10 / 10));
export const bodyKg = (g: number | null) => (g == null ? "—" : (g / 1000).toFixed(1).replace(".", ","));
export const cm = (mm: number | null) => (mm == null ? "—" : (mm / 10).toFixed(1).replace(".", ",").replace(/,0$/, ""));
