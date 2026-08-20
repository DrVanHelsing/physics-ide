/** "just now" / "5 min ago" / "3 h ago" / a date. Shared by the start menu and the status bar. */
export function relativeTime(ms, now = Date.now()) {
  if (!ms) return "";
  const delta = now - ms;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
}
