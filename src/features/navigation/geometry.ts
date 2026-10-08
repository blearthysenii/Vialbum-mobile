// Existing shared navigator geometry; media controls reserve space around it.
export const NAVIGATION_HEIGHT = 62;
export function navigationBottom(bottomInset: number) {
  return Math.max(bottomInset - 12, 8);
}
