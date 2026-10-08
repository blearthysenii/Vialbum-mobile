// One native frame request at a time; coalesce movement and ignore late cancelled results.
export function createScrubPreviewQueue<T>(generate: (time: number) => Promise<T>, show: (frame: T) => void, fail: (error: unknown) => void) {
  let session = 0;
  let running = false;
  let pending: { time: number; session: number } | null = null;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const job = pending; pending = null;
        try { const frame = await generate(job.time); if (job.session === session) show(frame); }
        catch (error) { if (job.session === session) fail(error); }
      }
    } finally { running = false; }
  }
  return {
    request(time: number) { pending = { time, session }; void drain(); },
    cancel() { session++; pending = null; },
  };
}
export function previewLeft(time: number, duration: number, trackWidth: number, previewWidth: number) {
  const fraction = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;
  return Math.max(0, Math.min(Math.max(0, trackWidth - previewWidth), fraction * trackWidth - previewWidth / 2));
}
