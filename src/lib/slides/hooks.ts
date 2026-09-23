// Numbered hooks ("6 ways to…", "5 Momente, die…") promise a number of items; the post needs
// exactly that many content slides or the content can't deliver the hook.

const NOT_A_LIST =
  /^(%|min|mins|minutes?|h|hrs?|hours?|days?|weeks?|months?|years?|seconds?|sek|sekunden|minuten|stunden|tage|wochen|monate|jahre|uhr|am|pm|x)\b/i;

/** The number of items a hook promises (2–10), or null if it doesn't promise a list. */
export function hookItemCount(hook: string): number | null {
  for (const m of hook.matchAll(/(?:^|[\s(])(\d{1,2})\s+(\S+)/g)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 10 && !NOT_A_LIST.test(m[2])) return n;
  }
  return null;
}
