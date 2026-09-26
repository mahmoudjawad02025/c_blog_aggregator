export function parseDuration(s: string): number {
  const m = s.match(/^(\d+)(ms|s|m|h)$/);
  if (!m) throw new Error("invalid duration");
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000;
  return n * mult;
}