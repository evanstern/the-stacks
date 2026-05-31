const easternTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatEasternTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return easternTimeFormatter.format(date);
}
