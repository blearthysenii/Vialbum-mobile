export function playbackFraction(time: number, duration: number) {
  return Number.isFinite(time) && Number.isFinite(duration) && duration > 0
    ? Math.max(0, Math.min(1, time / duration)) : 0;
}
export function scrubTime(x: number, width: number, duration: number) {
  return Number.isFinite(x) && width > 0 && Number.isFinite(duration)
    ? Math.max(0, Math.min(1, x / width)) * Math.max(0, duration) : 0;
}
export function playbackTime(seconds: number) {
  const value = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
