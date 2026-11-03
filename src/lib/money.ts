/**
 * Exact money arithmetic in the browser. Amounts arrive as strings ("3500.25"); they are converted to whole paisa
 * (bigint) for sums and comparisons, never to floating-point numbers.
 */
export function toPaisa(value: string | null | undefined): bigint {
  if (value == null) return 0n;
  const text = value.trim().replaceAll(",", "");
  if (text === "") return 0n;
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Not an amount: ${value}`);
  const [, minus, whole, fraction = ""] = match;
  const paisa = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return minus ? -paisa : paisa;
}

/** Whole paisa back to the API's string form, e.g. 350025n → "3500.25". */
export function fromPaisa(paisa: bigint): string {
  const negative = paisa < 0n;
  const abs = negative ? -paisa : paisa;
  const text = `${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

/** True when the text is a valid amount with at most 2 decimals (commas allowed). */
export function isAmount(value: string, { allowZero = false } = {}): boolean {
  try {
    const p = toPaisa(value);
    return value.trim() !== "" && (allowZero ? p >= 0n : p > 0n);
  } catch {
    return false;
  }
}

export function sumPaisa(values: (string | null | undefined)[]): bigint {
  return values.reduce<bigint>((total, v) => total + toPaisa(v), 0n);
}

/** Oldest-first allocation of a payment over balances (the server does the same by default). */
export function allocateOldestFirst(amount: bigint, balances: bigint[]): bigint[] {
  let left = amount;
  return balances.map((balance) => {
    const part = left > balance ? balance : left > 0n ? left : 0n;
    left -= part;
    return part;
  });
}
