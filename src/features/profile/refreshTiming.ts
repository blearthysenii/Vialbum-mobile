export function profileRefreshTiming() {
  const development = typeof __DEV__ !== 'undefined' && __DEV__;
  const started = development ? performance.now() : 0;
  const timings: Record<string, number | string> = {};
  return {
    async run<T>(label: string, operation: () => Promise<T>): Promise<T> {
      if (!development) return operation();
      const start = performance.now();
      console.debug('[Profile refresh] start', label);
      try { return await operation(); }
      finally { timings[label] = Math.round(performance.now() - start); console.debug('[Profile refresh] end', label, timings[label]); }
    },
    mark(label: string, value?: string) { if (development) timings[label] = value ?? Math.round(performance.now() - started); },
    finish() { if (development) { timings.critical = Math.round(performance.now() - started); console.debug('[Profile refresh] milliseconds', timings); } },
  };
}
export type ProfileRefreshTiming = ReturnType<typeof profileRefreshTiming>;
