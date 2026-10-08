import type { ImageRef } from 'expo-image';

// Strong native references bridge recycled view lifetimes, within an explicit LRU budget.
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_COUNT = 64;
const entries = new Map<string, { image: ImageRef; bytes: number; journey?: { namespace: string; uri: string } }>();
const pending = new Map<string, Promise<void>>();
let bytes = 0;
let epoch = 0;
let owner: string | undefined;
const journeyViewport = new Map<string, string>();
function selectOwner(scope: string) {
  if (owner !== scope) { clearDecodedThumbnails(); owner = scope; }
}
function key(scope: string, cacheKey: string, uri: string) {
  // Exact URI matching avoids treating a newly issued URL as already authorized.
  return JSON.stringify([scope, cacheKey, uri]);
}
function remember(id: string, image: ImageRef, journey?: { namespace: string; uri: string }) {
  const cost = Math.ceil(image.width * image.height * image.scale * image.scale * 4);
  if (!Number.isFinite(cost) || cost <= 0 || cost > MAX_BYTES) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[Profile thumbnail cache] skipped reference', { cost });
    return false;
  }
  const previous = entries.get(id);
  if (previous) { bytes -= previous.bytes; entries.delete(id); }
  entries.set(id, { image, bytes: cost, journey }); bytes += cost;
  if (journey && journeyViewport.has(journey.namespace)) journeyViewport.set(journey.namespace, journey.uri);
  while (entries.size > MAX_COUNT || bytes > MAX_BYTES) {
    // Protect the last visible Journey grid when Moments becomes active, within
    // at most half of the same byte/count budget. History stays normal LRU.
    const pinned = pinnedJourneyEntries();
    const oldest = [...entries.keys()].find(candidate => !pinned.has(candidate));
    if (oldest === undefined) break;
    bytes -= entries.get(oldest)!.bytes; entries.delete(oldest);
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[Profile thumbnail cache] retained', { count: entries.size, estimatedBytes: bytes });
  return entries.has(id);
}
function pinnedJourneyEntries() {
  const pinned = new Set<string>(), namespaces = new Set<string>(); let cost = 0;
  for (const [id, entry] of [...entries].reverse()) {
    if (entry.journey && namespaces.has(entry.journey.namespace)) continue;
    const visibleUri = entry.journey && journeyViewport.get(entry.journey.namespace);
    if (!visibleUri || visibleUri.split(/[?#]/, 1)[0] !== entry.journey!.uri.split(/[?#]/, 1)[0]) continue;
    if (cost + entry.bytes > MAX_BYTES / 2 || pinned.size >= MAX_COUNT / 2) continue;
    pinned.add(id); namespaces.add(entry.journey!.namespace); cost += entry.bytes;
  }
  return pinned;
}
export function setJourneyThumbnailViewport(scope: string, items: { namespace: string; uri: string }[]) {
  if (owner !== scope) return; // Ignore late callbacks from a previous account.
  journeyViewport.clear();
  for (const item of items.slice(0, MAX_COUNT / 2)) journeyViewport.set(item.namespace, item.uri);
}
export function decodedJourneyThumbnail(scope: string, cacheKey: string) {
  // The caller is an authenticated own-Profile tile. The account + immutable
  // media path/version + pixel size identifies its bitmap, not signing tokens.
  return decodedThumbnail(scope, cacheKey, 'journey-native');
}
export function decodedThumbnail(scope: string, cacheKey: string, uri: string) {
  selectOwner(scope);
  const id = key(scope, cacheKey, uri), entry = entries.get(id);
  if (entry) { entries.delete(id); entries.set(id, entry); }
  return entry?.image;
}
export function retainDecodedThumbnail(scope: string, cacheKey: string, uri: string, read: () => Promise<ImageRef | null>) {
  selectOwner(scope);
  const id = key(scope, cacheKey, uri);
  if (entries.has(id)) return Promise.resolve();
  const existing = pending.get(id); if (existing) return existing;
  const revision = epoch;
  const work = read().then(image => {
    if (!image || revision !== epoch || owner !== scope) return;
    remember(id, image);
  }).catch(error => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[Profile thumbnail cache] native cache read failed', error);
  })
    .finally(() => { if (pending.get(id) === work) pending.delete(id); });
  pending.set(id, work); return work;
}
export function clearDecodedThumbnails() {
  epoch++; entries.clear(); journeyViewport.clear(); pending.clear(); bytes = 0; owner = undefined;
  for (const task of journeyLoads.values()) task.resolve(null);
  journeyLoads.clear(); journeyQueue.length = 0;
}

// Journey originals must be downsampled before retention, not read as full-size
// UIImages after display. Visible callers share work; abandoned queued cells do
// not start downloads/decodes. The existing 64-entry/32 MiB budget is unchanged.
type JourneyLoad = {
  id: string; entryId: string; namespace: string; uri: string; scope: string; epoch: number; users: number; started: boolean;
  read: () => Promise<ImageRef>; promise: Promise<ImageRef | null>;
  resolve: (image: ImageRef | null) => void; reject: (error: unknown) => void;
};
const journeyLoads = new Map<string, JourneyLoad>();
const journeyQueue: JourneyLoad[] = [];
let activeJourneyLoads = 0;
function drainJourneys() {
  while (activeJourneyLoads < 2 && journeyQueue.length) {
    const task = journeyQueue.shift()!;
    if (!task.users || task.epoch !== epoch || owner !== task.scope) { task.resolve(null); continue; }
    task.started = true; activeJourneyLoads++;
    // Invoke on a microtask so a synchronous loader throw also releases its slot.
    void Promise.resolve().then(task.read).then(image => {
      if (task.epoch !== epoch || owner !== task.scope || !task.users) { task.resolve(null); return; }
      if (!remember(task.entryId, image, { namespace: task.namespace, uri: task.uri })) throw new Error('Decoded thumbnail exceeds retention budget');
      task.resolve(image);
    }).catch(error => {
      if (task.epoch !== epoch || owner !== task.scope || !task.users) task.resolve(null);
      else task.reject(error);
    }).finally(() => {
      activeJourneyLoads--;
      if (journeyLoads.get(task.id) === task) journeyLoads.delete(task.id);
      drainJourneys();
    });
  }
}
export function acquireJourneyThumbnail(scope: string, cacheKey: string, uri: string, read: () => Promise<ImageRef>, namespace = '') {
  const cached = decodedJourneyThumbnail(scope, cacheKey);
  if (cached) {
    if (namespace && journeyViewport.has(namespace)) journeyViewport.set(namespace, uri);
    return { promise: Promise.resolve(cached), release: () => {} };
  }
  const id = key(scope, cacheKey, uri);
  let task = journeyLoads.get(id);
  if (!task) {
    let resolve!: JourneyLoad['resolve'], reject!: JourneyLoad['reject'];
    const promise = new Promise<ImageRef | null>((yes, no) => { resolve = yes; reject = no; });
    task = { id, entryId: key(scope, cacheKey, 'journey-native'), namespace, uri, scope, epoch, users: 0, started: false, read, promise, resolve, reject };
    journeyLoads.set(id, task); journeyQueue.push(task);
  }
  task.users++; drainJourneys();
  const lease = task; let released = false;
  return {
    promise: task.promise,
    release() {
      if (released) return; released = true; lease.users--;
      if (!lease.users && !lease.started) {
        const index = journeyQueue.indexOf(lease); if (index >= 0) journeyQueue.splice(index, 1);
        if (journeyLoads.get(id) === lease) journeyLoads.delete(id);
        lease.resolve(null);
      }
    },
  };
}
export function decodedThumbnailCacheStats() {
  return { entries: entries.size, estimatedBytes: bytes, pinnedJourneyEntries: pinnedJourneyEntries().size, queuedJourneyLoads: journeyQueue.length, activeJourneyLoads, maxEntries: MAX_COUNT, maxBytes: MAX_BYTES };
}
