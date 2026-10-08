export type PhotoOrigin = { x: number; y: number; width: number; height: number; radius: number };

export function heroGeometry(frame: { width: number; height: number }, viewport: { width: number; height: number }, origin: PhotoOrigin | undefined, progress: number) {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  const source = origin ?? { x: (viewport.width - frame.width) / 2, y: (viewport.height - frame.height) / 2, ...frame, radius: 0 };
  const cover = Math.max(source.width / Math.max(1, frame.width), source.height / Math.max(1, frame.height));
  return {
    width: source.width + (frame.width - source.width) * p,
    height: source.height + (frame.height - source.height) * p,
    x: (source.x + source.width / 2 - viewport.width / 2) * (1 - p),
    y: (source.y + source.height / 2 - viewport.height / 2) * (1 - p),
    imageScale: cover + (1 - cover) * p,
    radius: source.radius * (1 - p),
  };
}
