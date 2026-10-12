/** Format full timestamps locally; old time-only values have no recoverable date. */
export function formatSyncTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value} (date unknown)`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const hour = date.getHours();
  return `${date.getMonth() + 1}/${date.getDate()} ${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}${hour >= 12 ? "PM" : "AM"}`;
}
