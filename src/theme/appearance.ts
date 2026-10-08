import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
export type AppearancePreference = 'system' | 'light' | 'dark';
const KEY = 'vialbum.appearance';
let state: { preference: AppearancePreference; ready: boolean } = { preference: 'system', ready: false };
const listeners = new Set<() => void>();
let restoring: Promise<void> | null = null;
let revision = 0;
let writes: Promise<void> = Promise.resolve();
const publish = (preference: AppearancePreference) => { state = { preference, ready: true }; listeners.forEach(fn => fn()); };
export const appearanceStore = {
  getSnapshot: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  restore() {
    if (restoring) return restoring;
    const restoringRevision = revision;
    restoring = SecureStore.getItemAsync(KEY).then(value => {
      if (revision !== restoringRevision) return;
      const preference = value === 'light' || value === 'dark' ? value : 'system';
      Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference); publish(preference);
    }).catch(() => { if (revision !== restoringRevision) return; Appearance.setColorScheme('unspecified'); publish('system'); });
    return restoring;
  },
  set(preference: AppearancePreference) {
    revision += 1;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference); publish(preference);
    const write = writes.catch(() => {}).then(() => SecureStore.setItemAsync(KEY, preference));
    writes = write; return write;
  },
};
export function useAppearancePreference() { return useSyncExternalStore(appearanceStore.subscribe, appearanceStore.getSnapshot, appearanceStore.getSnapshot); }
export function useAppColorScheme() {
  const { preference } = useAppearancePreference(); const system = useColorScheme();
  return preference === 'system' ? system : preference;
}
export function presentationInterfaceStyle(): 'light' | 'dark' {
  return (state.preference === 'system' ? Appearance.getColorScheme() : state.preference) === 'dark' ? 'dark' : 'light';
}
