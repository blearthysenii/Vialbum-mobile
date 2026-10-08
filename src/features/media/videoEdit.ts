export type VideoEdit = { trimStart: number; trimEnd: number; coverTime: number };
export function initialVideoEdit(duration: number): VideoEdit {
  return { trimStart: 0, trimEnd: Math.min(60, Math.max(0, duration)), coverTime: 0 };
}
export function moveTrim(edit: VideoEdit, edge: 'start' | 'end', value: number, duration: number): VideoEdit {
  const next = { ...edit };
  if (edge === 'start') next.trimStart = Math.max(0, Math.min(edit.trimEnd - 0.2, Math.max(edit.trimEnd - 60, value)));
  else next.trimEnd = Math.min(duration, Math.max(edit.trimStart + 0.2, Math.min(edit.trimStart + 60, value)));
  next.coverTime = Math.max(next.trimStart, Math.min(next.trimEnd - 0.05, edit.coverTime));
  return next;
}
export function videoEditError(edit: VideoEdit, duration?: number) {
  return ![edit.trimStart, edit.trimEnd, edit.coverTime].every(Number.isFinite)
    || edit.trimStart < 0 || edit.trimEnd <= edit.trimStart || edit.trimEnd - edit.trimStart > 60.001
    || duration !== undefined && edit.trimEnd > duration + 0.1
    || edit.coverTime < edit.trimStart || edit.coverTime > edit.trimEnd
    ? 'Select a video segment of up to 60 seconds and a cover inside it.' : null;
}
