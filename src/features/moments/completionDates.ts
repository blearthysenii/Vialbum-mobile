export function journeyDateRange(start: string, end: string, locale?: string) {
  const parse = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  const from = parse(start); const to = parse(end);
  if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return '';
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const range = typeof formatter.formatRange === 'function' ? formatter.formatRange(from, to)
    : start === end ? formatter.format(from)
    : from.getUTCFullYear() === to.getUTCFullYear() && from.getUTCMonth() === to.getUTCMonth()
      ? `${new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(from)} — ${formatter.format(to)}`
      : `${formatter.format(from)} — ${formatter.format(to)}`;
  return range.toLocaleUpperCase(locale);
}
