export function formatCalendarDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, options);
}

export function formatDateTime(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDateRange(start: string, end: string) {
  return `${formatCalendarDate(start)} — ${formatCalendarDate(end)}`;
}

export function formatCoordinates(latitude: string | null, longitude: string | null) {
  return latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : null;
}
