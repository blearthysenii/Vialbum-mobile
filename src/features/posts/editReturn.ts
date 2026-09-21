// One-shot editor result: Cancel can reuse the mounted post, while persisted
// mutations (including immediate uploads/deletions) still revalidate on return.
const edits = new Map<string, boolean>();

export function beginPostEdit(id: string) {
  edits.set(id, false);
}

export function markPostEditChanged(id: string) {
  edits.set(id, true);
}

export function consumePostEdit(id: string): boolean | undefined {
  const changed = edits.get(id);
  edits.delete(id);
  return changed;
}
