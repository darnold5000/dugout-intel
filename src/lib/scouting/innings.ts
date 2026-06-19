/** Convert GameChanger IP notation (e.g. 2.1 = 2⅓) to decimal innings. */
export function parseBaseballInnings(value: number): number {
  const whole = Math.floor(value);
  const tenths = Math.round((value - whole) * 10);
  if (tenths === 1) return whole + 1 / 3;
  if (tenths === 2) return whole + 2 / 3;
  return value;
}

/** Format decimal innings back to baseball notation. */
export function formatBaseballInnings(decimal: number): string {
  const whole = Math.floor(decimal);
  const frac = decimal - whole;
  if (Math.abs(frac - 1 / 3) < 0.05) return `${whole}.1`;
  if (Math.abs(frac - 2 / 3) < 0.05) return `${whole}.2`;
  if (frac < 0.05) return `${whole}`;
  return decimal.toFixed(1);
}
