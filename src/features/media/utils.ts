export function photoDayNumber(startDate: string, capturedAt: string | null, createdAt: string) {
  const photoDate = (capturedAt ?? createdAt).slice(0, 10);
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const photo = Date.parse(`${photoDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(photo)
    ? Math.round((photo - start) / 86400000) + 1
    : null;
}
