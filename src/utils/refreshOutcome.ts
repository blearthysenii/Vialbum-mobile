export type RefreshOutcome = { status: 'success' | 'network' | 'authorization' | 'cancelled'; httpStatus?: number };
export function requireRefreshSuccess(result: unknown) {
  if (result && typeof result === 'object' && 'status' in result && result.status !== 'success') {
    throw Object.assign(new Error('Refresh failed'), { outcome: result.status });
  }
}
export function summarizeRefresh(results: PromiseSettledResult<unknown>[]): 'success' | 'partial' | 'network' | 'authorization' | 'cancelled' {
  const failures = results.filter(result => result.status === 'rejected');
  if (!failures.length) return 'success';
  if (failures.length !== results.length) return 'partial';
  const reasons = failures.map(result => result.status === 'rejected' ? result.reason : null);
  if (reasons.some(reason => reason?.status === 401 || reason?.status === 403 || reason?.outcome === 'authorization')) return 'authorization';
  if (reasons.every(reason => reason?.outcome === 'cancelled' || reason?.name === 'AbortError')) return 'cancelled';
  return 'network';
}
